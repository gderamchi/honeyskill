import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { acquire, inventory, type Inventory } from '../../core/src/acquisition.js';
import { analyzeNative, RULES_VERSION } from '../../core/src/analysis.js';
import { redactApparentSecrets } from '../../core/src/semantic.js';
import { redactSecurityText } from './redaction.js';
import type { Finding } from '../../contracts/src/index.js';
import { includeSecurityText } from './text-inventory.js';
import { reviewSecuritySemantic, OpenAISecurityProvider, SECURITY_SEMANTIC_VERSION, type SecuritySemanticProvider } from './semantic.js';
import { scanCisco, type CiscoResult } from './cisco.js';
import { SECURITY_VERSION, SecurityReviewSchema, inspectionOutcome, snapshotFingerprint, type EngineResult, type SecurityFinding, type SecurityReview } from './types.js';

export interface SecurityOptions {
  scannerBinary?: string; semantic?: boolean; apiKey?: string; skill?: string;
  // Injection points are for independently labelled tests, not CLI verdict overrides.
  ciscoProvider?: (folder: string) => Promise<CiscoResult>; semanticProvider?: SecuritySemanticProvider;
}
const mapFinding = (finding: Finding, engine: 'native' | 'semantic'): SecurityFinding => ({
  engine, rule: finding.category, severity: finding.severity,
  title: redactSecurityText(finding.financialConsequence), explanation: redactSecurityText(finding.explanation),
  evidence: finding.evidence.map(item => ({ file: item.file, line: item.line, excerpt: redactSecurityText(item.excerpt), verified: finding.supported, ...(item.redacted || redactSecurityText(item.excerpt)!==item.excerpt ? { redacted: true } : {}) })),
});
const gapsOf = (input: Inventory) => [...input.coverage.errors, ...input.coverage.limitsReached, ...input.coverage.ignored.map(item => `${item.file}: ${item.reason}`)];

/** No activation path, acquired script execution, or real profile access exists here. */
export async function reviewSecurity(source: string, options: SecurityOptions = {}): Promise<SecurityReview> {
  const started = performance.now(), startedAt = new Date().toISOString(), id = `security-${randomUUID()}`;
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'skillgate-inspection-'));
  try {
    const snapshot = path.join(temporary, 'snapshot');
    const acquired = await acquire(source, snapshot, options.skill), input = acquired.inventory;
    if (!input.texts.has('SKILL.md')) throw new Error('A readable SKILL.md is required.');
    await includeSecurityText(snapshot,input);
    const gaps = gapsOf(input), engines: EngineResult[] = [];
    const nativeStart = performance.now(), native = analyzeNative(input);
    engines.push({ engine: 'native', version: RULES_VERSION, kind: 'static', status: gaps.length ? 'partial' : 'complete',
      durationMs: performance.now() - nativeStart, findings: native.findings.map(finding => mapFinding(finding, 'native')), errors: [...gaps] });
    const cisco = await (options.ciscoProvider ? options.ciscoProvider(snapshot) : scanCisco(snapshot, { binary: options.scannerBinary }));
    const realSnapshot = await fs.realpath(snapshot);
    const portable = (value: string) => redactSecurityText(value.split(realSnapshot).join('[snapshot]').split(snapshot).join('[snapshot]'));
    engines.push({ engine: 'cisco', version: cisco.version ?? 'unavailable', kind: 'static', status: cisco.status,
      durationMs: cisco.durationMs, errors: cisco.errors.map(portable),
      findings: cisco.findings.map(finding => ({ engine: 'cisco', rule: finding.ruleId, severity: finding.severity,
        title: portable(finding.title), explanation: portable(finding.description),
        evidence: finding.filePath ? [{ file: finding.filePath, line: finding.lineNumber,
          ...(finding.snippet === undefined ? {} : { excerpt: portable(finding.snippet), ...(finding.evidenceRedacted || portable(finding.snippet) !== finding.snippet ? { redacted: true } : {}) }),
          verified: ['verified', 'relocated'].includes(finding.evidenceStatus) }] : [] })) });
    if (options.semantic) {
      const provider = options.semanticProvider ?? (options.apiKey ? new OpenAISecurityProvider(options.apiKey) : undefined);
      if (!provider) engines.push({ engine: 'semantic', version: SECURITY_SEMANTIC_VERSION, kind: 'semantic', status: 'error', durationMs: 0,
        findings: [], errors: ['Authorized OpenAI key unavailable; no model request made.'], model: 'gpt-6-luna' });
      else engines.push(await reviewSecuritySemantic(input,provider));
    } else engines.push({ engine: 'semantic', version: SECURITY_SEMANTIC_VERSION, kind: 'semantic', status: 'not_requested', durationMs: 0, findings: [], errors: [] });
    if ((await inventory(snapshot)).fingerprint !== input.fingerprint) gaps.push('Snapshot changed during inspection.');
    const report = SecurityReviewSchema.parse({ schemaVersion: 1, version: SECURITY_VERSION, id, name: options.skill ?? 'inspected-skill',
      startedAt, durationMs: performance.now() - started, fingerprint: snapshotFingerprint(input.manifest), manifest: input.manifest,
      selectedEngines: engines.filter(item => item.status !== 'not_requested').map(item => item.engine), engines,
      ...inspectionOutcome(engines, gaps), coverage: { files: input.manifest.length, readableFiles: input.texts.size, gaps, execution: 'not_executed', runtimeSupport: 'not_assessed' },
      limitations: ['Package inspection only: skill code and dependencies were not executed. No installation was attempted.',
        'No alert is not a benign verdict. Static and semantic engines can miss attacks.',
        'Cisco behavioral_analyzer is static AST/dataflow analysis, not a runtime trace.',
        'Semantic review covers SG-01 through SG-04 and FIN-01 through FIN-06 in deterministic source batches. It is not a universal malware judge; cross-batch interactions can be missed.',
        'No whole-package runtime coverage is claimed; the separate capability monitor protects only mediated typed actions.',
        'Remote payloads and undeclared dependencies are not fetched or executed.'] });
    // No absolute workstation paths from acquisition are copied into the portable result.
    return report;
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

export function publicError(error: unknown): string {
  // Acquisition messages can contain local paths or hostile terminal sequences.
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : 'INSPECTION_ERROR';
  return redactApparentSecrets(code).replace(/[^a-zA-Z0-9_-]/g, '').slice(0,100) || 'INSPECTION_ERROR';
}
