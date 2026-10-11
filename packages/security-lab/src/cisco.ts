import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const CISCO_VERSION = '2.2.2';
export const CISCO_ANALYZERS = ['static_analyzer', 'bytecode', 'pipeline', 'correlation', 'behavioral_analyzer'] as const;
const MAX_OUTPUT = 8 * 1024 * 1024;
const MAX_SOURCE = 5 * 1024 * 1024;
const MAX_FINDINGS = 5000;
const severityValues = ['info', 'low', 'medium', 'high', 'critical'] as const;

export interface CiscoFinding {
  id: string;
  ruleId: string;
  severity: typeof severityValues[number];
  category: string;
  title: string;
  description: string;
  analyzer: string;
  filePath?: string;
  lineNumber?: number;
  upstreamLineNumber?: number;
  snippet?: string;
  evidenceStatus: 'verified' | 'relocated' | 'unavailable';
  /** The exact upstream redaction was independently validated without returning source secrets. */
  evidenceRedacted?: true;
}

export interface CiscoResult {
  status: 'complete' | 'error' | 'partial' | 'unsupported';
  findings: CiscoFinding[];
  errors: string[];
  version: string | null;
  durationMs: number;
  analyzersUsed: string[];
  /** Sanitized upstream JSON, retained as evidence rather than treated as a verdict. */
  raw?: unknown;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, max = 20_000): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const inside = (root: string, file: string) => { const rel = path.relative(root, file); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };
const empty = (status: CiscoResult['status'], error: string, version: string | null = null): CiscoResult =>
  ({ status, findings: [], errors: [error], version, durationMs: 0, analyzersUsed: [] });

function sanitizedRaw(raw: unknown, root: string): unknown {
  // Replace only this known workstation prefix; never include stderr or provider credentials.
  return JSON.parse(JSON.stringify(raw).split(root).join('[snapshot]'));
}

/** Cisco 2.2.2 loader strips frontmatter and surrounding body whitespace. Never rewrite snapshot bytes. */
function instructionBody(source: string): { content: string; lineOffset: number } | undefined {
  const header = /^---[ \t]*\n[\s\S]*?\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(source);
  if (source.startsWith('---') && !header) return undefined;
  const tail = source.slice(header?.[0].length ?? 0), content = tail.trim();
  const start = source.length - tail.trimStart().length;
  return { content, lineOffset: source.slice(0, start).split('\n').length - 1 };
}

/** Match pinned static.py _redact_secret semantics; never emit the recovered secret. */
function redactedSecret(value: string): string {
  for (const prefix of ['AKIA', 'AGPA', 'AIDA', 'AROA', 'AIPA', 'ANPA', 'ANVA', 'ASIA', 'AIza',
    'sk_live_', 'pk_live_', 'sk_test_', 'pk_test_', 'ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'eyJ'])
    if (value.startsWith(prefix)) return prefix + '****';
  if (value.includes('-----BEGIN') && value.includes('PRIVATE KEY')) return '-----BEGIN PRIVATE KEY----- [REDACTED]';
  const characters = [...value];
  return characters.slice(0, characters.length <= 8 ? 2 : 4).join('') + '****';
}

function verifiesRedactedSecret(item: Record<string, unknown>, source: string, snippet: string, line: number | undefined): boolean {
  if (item.analyzer !== 'static' || item.category !== 'hardcoded_secrets' || !line || !record(item.metadata)) return false;
  const metadata = item.metadata, start = metadata.signature_match_start, end = metadata.signature_match_end;
  const original = source.split('\n')[line - 1]?.trim();
  if (original === undefined || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || Number(start) < 0 || Number(end) <= Number(start)) return false;
  const characters = [...original];
  if (Number(end) > characters.length) return false;
  const matched = characters.slice(Number(start), Number(end)).join('');
  const replacement = redactedSecret(matched);
  return metadata.matched_text === replacement && original.split(matched).join(replacement) === snippet;
}

/** Reconstruct only documented upstream coordinate systems, then require the exact source quotation. */
function correctedSourceLine(item: Record<string, unknown>, source: string, snippet: string, relativeFile: string, reported: number | undefined): number | undefined {
  if (!reported || !record(item.metadata)) return undefined;
  const primary = relativeFile === 'SKILL.md', body = primary ? instructionBody(source) : { content: source, lineOffset: 0 };
  if (!body) return undefined;
  if (item.analyzer === 'static' && string(item.rule_id) && item.rule_id.startsWith('YARA_') && primary
      && string(item.metadata.yara_rule) && item.rule_id === 'YARA_' + item.metadata.yara_rule) {
    const physical = reported + body.lineOffset;
    if (source.split('\n')[physical - 1]?.includes(snippet)) return physical;
  }
  // behavioral_analyzer.py's Python block loop omits the opening-fence newline and the primary body offset.
  if (item.analyzer === 'behavioral' && string(item.rule_id) && item.rule_id.startsWith('MDBLOCK_PYTHON_')
      && item.metadata.from_code_block === true && item.metadata.block_language === 'python') {
    const candidates: number[] = [];
    for (const match of body.content.matchAll(/```(\w*)\n([\s\S]*?)```/g)) {
      if (match[1]!.toLowerCase() !== 'python' || match[2]!.trim().split('\n').length < 2) continue;
      const base: number = body.content.slice(0, match.index).split('\n').length;
      const index = reported - base, blockLines = match[2]!.split('\n');
      if (index >= 0 && blockLines[index]?.trim() === snippet) candidates.push(reported + 1 + body.lineOffset);
    }
    if (candidates.length === 1 && source.split('\n')[candidates[0]! - 1]?.includes(snippet)) return candidates[0];
  }
  return undefined;
}

/** Validate Cisco 2.2.2's actual CLI JSON. A successful scan is not a safety certificate. */
export async function parseCiscoResult(raw: unknown, snapshotFolder: string, version = CISCO_VERSION): Promise<CiscoResult> {
  if (!record(raw) || !Array.isArray(raw.findings) || raw.findings.length > MAX_FINDINGS ||
      raw.findings_count !== raw.findings.length || !Array.isArray(raw.analyzers_used) ||
      !raw.analyzers_used.every(name => string(name, 100)) || !record(raw.scan_metadata)) {
    return empty('error', 'Cisco returned an invalid or oversized result contract.', version);
  }
  const root = await fs.realpath(snapshotFolder);
  const result: CiscoResult = { status: 'complete', findings: [], errors: [], version, durationMs: 0,
    analyzersUsed: raw.analyzers_used as string[], raw: sanitizedRaw(raw, root) };
  if (version !== CISCO_VERSION) result.errors.push(`Unsupported Cisco version; expected ${CISCO_VERSION}.`);
  if (!string(raw.skill_path) || path.resolve(raw.skill_path) !== root) result.errors.push('Cisco result does not identify the exact snapshot directory.');
  for (const name of CISCO_ANALYZERS) {
    if (!result.analyzersUsed.includes(name)) result.errors.push(`Requested analyzer did not run: ${name}.`);
  }
  if (result.analyzersUsed.some(name => !(CISCO_ANALYZERS as readonly string[]).includes(name))) result.errors.push('An unexpected analyzer ran.');
  if (raw.analyzers_failed !== undefined && (!Array.isArray(raw.analyzers_failed) || raw.analyzers_failed.length)) {
    result.errors.push('Cisco reports one or more failed analyzers.');
  }
  if (raw.suppressed_findings !== undefined && (!Array.isArray(raw.suppressed_findings) || raw.suppressed_findings.length)) {
    result.errors.push('Cisco suppressed findings; this profile requires an unsuppressed audit.');
  }
  const metadata = raw.scan_metadata;
  const contract = metadata.rule_contract;
  if (!record(contract) || contract.status !== 'passed' || contract.invalid_findings !== 0 ||
      !Array.isArray(contract.errors) || contract.errors.length) result.errors.push('Cisco finding-contract validation is absent or incomplete.');
  const cel = metadata.cel;
  if (!record(cel) || cel.mode !== 'shadow' || cel.suppressed !== 0 || cel.projection_incomplete !== 0 ||
      cel.fallbacks !== 0 || !Array.isArray(cel.errors) || cel.errors.length) result.errors.push('Cisco policy evaluation is absent, incomplete or suppressing findings.');
  if (metadata.loader || metadata.adjudicator || raw.llm_usage) result.errors.push('Unexpected fallback loading or model-assisted evaluation.');
  // Some upstream stages encode coverage loss as INFO findings, rather than failing the process.
  const coverageRule = /(?:FAILED|FAILURE|ERROR|TIMEOUT|TRUNCAT|SKIPPED|UNSUPPORTED|UNANALYZABLE|UNANALYSABLE|LOW_ANALYZABILITY|CONTEXT_BUDGET|LOAD_FALLBACK|SIZE_LIMIT|BUDGET_EXCEEDED|ARCHIVE_ZIP_BOMB)/i;
  const sourceCache = new Map<string, string>();
  for (let index = 0; index < raw.findings.length; index++) {
    const item = raw.findings[index];
    if (!record(item) || !string(item.id, 300) || !string(item.rule_id, 300) || !string(item.title, 2000) ||
        !string(item.description) || !string(item.category, 200) || !string(item.severity, 30) ||
        !severityValues.includes(item.severity.toLowerCase() as typeof severityValues[number])) {
      result.errors.push(`Finding ${index + 1} has an invalid schema.`); continue;
    }
    const finding: CiscoFinding = { id: item.id, ruleId: item.rule_id, severity: item.severity.toLowerCase() as CiscoFinding['severity'],
      category: item.category, title: item.title, description: item.description,
      analyzer: string(item.analyzer, 100) ? item.analyzer : 'unspecified', evidenceStatus: 'unavailable' };
    result.findings.push(finding);
    if (coverageRule.test(finding.ruleId)) result.errors.push(`Coverage finding: ${finding.ruleId}.`);
    if (item.line_number !== undefined && item.line_number !== null && (!Number.isSafeInteger(item.line_number) || Number(item.line_number) < 1)) {
      result.errors.push(`Finding ${index + 1} has an invalid source line.`); continue;
    }
    if (item.line_number != null) finding.upstreamLineNumber = Number(item.line_number);
    if (item.file_path == null) {
      if (item.snippet != null || item.line_number != null) result.errors.push(`Finding ${index + 1} has source evidence without a file.`);
      continue;
    }
    if (!string(item.file_path, 2000) || item.file_path.includes('\0') || item.file_path.includes('\\')) {
      result.errors.push(`Finding ${index + 1} has an invalid source path.`); continue;
    }
    try {
      const target = path.resolve(root, item.file_path);
      if (!inside(root, target)) throw new Error('outside');
      const real = await fs.realpath(target);
      if (!inside(root, real)) throw new Error('outside');
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SOURCE) throw new Error('unsupported');
      finding.filePath = path.relative(root, target).split(path.sep).join('/');
      if (item.snippet == null) {
        if (finding.upstreamLineNumber !== undefined) {
          let content = sourceCache.get(real);
          if (content === undefined) { content = await fs.readFile(real, 'utf8'); sourceCache.set(real, content); }
          if (finding.upstreamLineNumber > content.split('\n').length) throw new Error('line');
          // A line pointer with no quotation is a location, not independently verified evidence.
          finding.lineNumber = finding.upstreamLineNumber;
        }
        continue;
      }
      if (!string(item.snippet)) throw new Error('snippet');
      let content = sourceCache.get(real);
      if (content === undefined) { content = await fs.readFile(real, 'utf8'); sourceCache.set(real, content); }
      const normalized = content.replace(/\r\n/g, '\n');
      const snippet = item.snippet.replace(/\r\n/g, '\n');
      const offset = normalized.indexOf(snippet);
      if (offset < 0) {
        if (!verifiesRedactedSecret(item, normalized, snippet, finding.upstreamLineNumber)) throw new Error('citation');
        finding.snippet = item.snippet; finding.lineNumber = finding.upstreamLineNumber;
        finding.evidenceStatus = 'verified'; finding.evidenceRedacted = true;
        continue;
      }
      finding.snippet = item.snippet;
      const observedLine = normalized.slice(0, offset).split('\n').length;
      const lines = normalized.split('\n');
      const reported = finding.upstreamLineNumber;
      const corrected = correctedSourceLine(item, normalized, snippet, finding.filePath, reported);
      if (reported && lines.slice(reported - 1, reported - 1 + snippet.split('\n').length).join('\n').includes(snippet)) {
        finding.lineNumber = reported; finding.evidenceStatus = 'verified';
      } else if (corrected !== undefined) {
        finding.lineNumber = corrected;
        finding.evidenceStatus = 'relocated';
      } else if (normalized.indexOf(snippet, offset + 1) < 0) {
        // Other upstream coordinates may be relocated only by a unique exact quotation.
        finding.lineNumber = observedLine; finding.evidenceStatus = 'relocated';
      } else {
        result.errors.push(`Finding ${index + 1} has ambiguous source-line evidence.`);
      }
    } catch {
      delete finding.filePath; delete finding.lineNumber; delete finding.snippet;
      result.errors.push(`Finding ${index + 1} has unverifiable source evidence.`);
    }
  }
  if (result.errors.length) result.status = 'partial';
  return result;
}

interface ProcessResult { stdout: string; stderr: string; code: number | null; failure?: string; }
function run(binary: string, args: string[], cwd: string, timeoutMs: number): Promise<ProcessResult> {
  return new Promise(resolve => {
    const child = spawn(binary, args, { shell: false, cwd, stdio: ['ignore', 'pipe', 'pipe'],
      // Explicit allowlist: no API keys, provider/config flags, PYTHONPATH, dotenv or user PATH.
      env: { PATH: '/usr/bin:/bin', PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1',
        PYTHON_DOTENV_DISABLED: '1', LITELLM_LOCAL_MODEL_COST_MAP: 'True', HF_HUB_OFFLINE: '1', NO_COLOR: '1' } });
    let stdout = '', stderr = '', bytes = 0, failure: string | undefined;
    const timer = setTimeout(() => { failure = 'Cisco process exceeded its deadline.'; child.kill('SIGKILL'); }, timeoutMs);
    const collect = (chunk: Buffer, output: 'stdout' | 'stderr') => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT) { failure = 'Cisco process exceeded its output limit.'; child.kill('SIGKILL'); return; }
      if (output === 'stdout') stdout += chunk.toString('utf8'); else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', chunk => collect(chunk, 'stdout'));
    child.stderr.on('data', chunk => collect(chunk, 'stderr'));
    child.on('error', () => { clearTimeout(timer); resolve({ stdout: '', stderr: '', code: null, failure: 'Cisco executable could not be started.' }); });
    child.on('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code, failure }); });
  });
}

async function snapshotDigest(root: string): Promise<string> {
  const hash = createHash('sha256');
  let count = 0, total = 0;
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 20) throw new Error('Snapshot depth limit');
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (++count > 1000 || entry.isSymbolicLink() || entry.name === '.git') throw new Error('Unsupported snapshot entry');
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) { await visit(target, depth + 1); continue; }
      if (!entry.isFile()) throw new Error('Unsupported snapshot entry');
      const stat = await fs.lstat(target);
      if (stat.size > MAX_SOURCE || (total += stat.size) > 32 * 1024 * 1024) throw new Error('Snapshot size limit');
      const content = await fs.readFile(target);
      hash.update(path.relative(root, target)); hash.update('\0'); hash.update(content); hash.update('\0');
    }
  };
  await visit(root, 0);
  return hash.digest('hex');
}

/** Run the pinned, externally installed scanner. This reads acquired skill code as data only. */
export async function scanCisco(snapshotFolder: string, options: { binary?: string; timeoutMs?: number } = {}): Promise<CiscoResult> {
  const started = performance.now();
  const binary = options.binary ?? process.env.HONEYSKILL_CISCO_BIN ?? process.env.SKILLGATE_CISCO_BIN;
  if (!binary || !path.isAbsolute(binary)) return empty('unsupported', 'Set HONEYSKILL_CISCO_BIN to the absolute path (legacy SKILLGATE_CISCO_BIN is also accepted) of the pinned skill-scanner 2.2.2 executable.');
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) return empty('error', 'Cisco timeout must be between 1 and 600000 milliseconds.');
  let temp: string | undefined;
  let version: string | null = null;
  try {
    const root = await fs.realpath(snapshotFolder);
    if (!(await fs.stat(root)).isDirectory()) return empty('error', 'Cisco snapshot must be a directory.');
    if (inside(root, path.resolve(binary)) || inside(root, await fs.realpath(binary))) return empty('error', 'Cisco executable cannot come from the inspected snapshot.');
    let digest: string;
    try { digest = await snapshotDigest(root); }
    catch { return empty('unsupported', 'Cisco requires a bounded regular-file snapshot without symlinks or .git entries.'); }
    temp = await fs.mkdtemp(path.join(os.tmpdir(), 'honeyskill-cisco-'));
    const checked = await run(binary, ['--version'], temp, Math.min(timeoutMs, 30_000));
    const match = /^skill-scanner (\d+\.\d+\.\d+)\s*$/.exec(checked.stdout);
    version = match?.[1] ?? null;
    if (checked.failure || checked.code !== 0 || version !== CISCO_VERSION) {
      return { ...empty('unsupported', checked.failure ?? `Expected Cisco ${CISCO_VERSION}; version check did not match.`, version), durationMs: performance.now() - started };
    }
    const remaining = timeoutMs - (performance.now() - started);
    if (remaining <= 0) return empty('error', 'Cisco process exceeded its deadline.', version);
    const scan = await run(binary, ['scan', root, '--format', 'json', '--use-behavioral', '--policy', 'balanced', '--cel-mode', 'shadow'], temp, remaining);
    if (scan.failure) return { ...empty('error', scan.failure, version), durationMs: performance.now() - started };
    let raw: unknown;
    try { raw = JSON.parse(scan.stdout); } catch { return { ...empty('error', 'Cisco did not return valid JSON.', version), durationMs: performance.now() - started }; }
    const result = await parseCiscoResult(raw, root, version);
    if (await snapshotDigest(root) !== digest) { result.status = 'partial'; result.errors.push('Snapshot bytes changed during Cisco analysis.'); }
    if (scan.code !== 0) { result.status = 'partial'; result.errors.push(`Cisco exited with status ${scan.code ?? 'signal'}.`); }
    if (/\b(?:skipp(?:ed|ing)|truncat\w*|failed to (?:read|parse|analy[sz]e)|analysis failed)\b/i.test(scan.stderr)) {
      result.status = 'partial'; result.errors.push('Cisco stderr reports incomplete analysis.');
    }
    result.durationMs = performance.now() - started;
    return result;
  } catch {
    return { ...empty('error', 'Cisco snapshot or executable could not be accessed.', version), durationMs: performance.now() - started };
  } finally { if (temp) await fs.rm(temp, { recursive: true, force: true }); }
}
