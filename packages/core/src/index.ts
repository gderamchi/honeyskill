import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
  ConfigSchema, ExceptionSchema, InstallRecordSchema, ScanReportSchema,
  type Config, type Finding, type InstallException, type InstallRecord, type ScanReport,
} from '../../contracts/src/index.js';
import { acquire, inventory, skillMetadata, finalizeCoverage, type Inventory } from './acquisition.js';
import { analyzeNative, checkReferences, CORPUS_VERSION, decide, ENGINE_VERSION, POLICY_VERSION, RULES_VERSION } from './analysis.js';
import { atomicJson, ensureDirectory, ensureState, exists, readJson, safeId, safeName, SkillGateError, stateDir, withTargetLock } from './storage.js';

export { LIMITS, inventory, safeRelative } from './acquisition.js';
export { decide, ENGINE_VERSION, RULES_VERSION, POLICY_VERSION, CORPUS_VERSION } from './analysis.js';
export { sanitizeTerminal, SkillGateError } from './storage.js';
export { OpenAIResponsesProvider, redactApparentSecrets } from './semantic.js';
export * from '../../contracts/src/index.js';

export interface SemanticProvider {
  name: string;
  analyze(input: { files: { path: string; content: string }[]; model: string }): Promise<unknown>;
}
export interface ScanOptions { skill?: string; provider?: SemanticProvider }
export interface AddResult { report: ScanReport; installation?: InstallRecord }
const recordPath = (root: string, name: string): string => path.join(stateDir(root), 'installs', `${safeName(name)}.json`);
const reportPath = (root: string, id: string): string => path.join(stateDir(root), 'reports', `${safeId(id)}.json`);
export const exceptionConfirmation = (report: ScanReport): string => `INSTALL ${report.id} ${report.fingerprint}`;

export async function initProject(projectRoot: string, options: Partial<Pick<Config, 'profile' | 'semanticConsent' | 'model' | 'retentionDays'>> = {}): Promise<Config> {
  await ensureState(projectRoot);
  const file = path.join(stateDir(projectRoot), 'config.json');
  const current = await exists(file) ? ConfigSchema.parse(await readJson(file)) : undefined;
  const config = ConfigSchema.parse({ version: 1, agent: 'codex', target: '.agents/skills', profile: 'static', semanticConsent: false, model: 'gpt-4.1-mini', retentionDays: 30, ...current, ...options });
  await atomicJson(file, config);
  return config;
}
export async function loadConfig(projectRoot: string): Promise<Config> {
  const file = path.join(stateDir(projectRoot), 'config.json');
  if (!await exists(file)) throw new SkillGateError('NOT_INITIALIZED', 'Configuration missing. Run skillgate init --agent codex.');
  await ensureState(projectRoot);
  return ConfigSchema.parse(await readJson(file));
}
async function semanticAnalysis(input: Inventory, config: Config, provider: SemanticProvider | undefined, report: ScanReport): Promise<void> {
  if (!config.semanticConsent || !provider) {
    report.analyses.push({ engine: 'semantic', status: 'unavailable', detail: config.semanticConsent ? 'Provider missing: no external call was made.' : 'Consent to share content externally is missing.' });
    input.coverage.errors.push('Required hybrid analysis is unavailable.'); return;
  }
  // Implemented in semantic.ts; dynamic loading keeps the static path independent from network code.
  const { runSemantic } = await import('./semantic.js');
  await runSemantic(input, config, provider, report);
}
export async function scanSkill(projectRoot: string, source: string, options: ScanOptions = {}): Promise<ScanReport> {
  const config = await loadConfig(projectRoot), started = performance.now(), startedAt = new Date().toISOString();
  const id = `scan-${randomUUID()}`, directory = path.join(stateDir(projectRoot), 'quarantine', id, 'package');
  const acquired = await acquire(source, directory, options.skill), collected = acquired.inventory;
  const main = collected.texts.get('SKILL.md');
  if (!main) throw new SkillGateError('INVALID_SKILL', 'SKILL.md is missing, too large, or unreadable.');
  const metadata = skillMetadata(main);
  if (options.skill && metadata.name !== options.skill) throw new SkillGateError('SKILL_MISMATCH', 'The name in SKILL.md does not match the requested skill.');
  checkReferences(collected);
  const native = analyzeNative(collected);
  const report: ScanReport = {
    schemaVersion: 1, id, name: metadata.name, source: acquired.source, fingerprint: collected.fingerprint,
    startedAt, completedAt: startedAt, profile: config.profile,
    engineVersion: ENGINE_VERSION, rulesVersion: RULES_VERSION, corpusVersion: CORPUS_VERSION, policyVersion: POLICY_VERSION,
    analyses: [{ engine: 'native', status: 'completed', detail: 'Static analysis of the collected bytes; no scripts were executed.' }],
    coverage: collected.coverage, findings: native.findings, risk: native.findings.length ? 'detected' : 'none', decision: 'review',
    capabilities: native.capabilities, durationMs: 0, manifest: collected.manifest,
    limitations: ['Only installations and updates routed through SkillGate are checked.', 'No guarantee of complete safety; no transaction checks during execution.', 'The actual financial environment and its permissions are not inspected.', 'The system owner can modify local snapshots and logs.', config.profile === 'static' ? 'Static analysis: heuristic rules, without external model reasoning.' : 'Hybrid analysis: reduced content and apparent secrets masked, without a guarantee of complete redaction.'],
  };
  if (config.profile === 'hybrid') await semanticAnalysis(collected, config, options.provider, report);
  finalizeCoverage(report.coverage);
  report.risk = report.findings.length ? 'detected' : 'none'; report.decision = decide(report.findings, report.coverage);
  report.completedAt = new Date().toISOString(); report.durationMs = Math.round(performance.now() - started);
  const validated = ScanReportSchema.parse(report); await atomicJson(reportPath(projectRoot, id), validated);
  return validated;
}
export async function readReport(projectRoot: string, id: string): Promise<ScanReport> {
  await loadConfig(projectRoot);
  const file = reportPath(projectRoot, id);
  if (!await exists(file)) throw new SkillGateError('REPORT_NOT_FOUND', 'Report not found.');
  return ScanReportSchema.parse(await readJson(file));
}
export async function listReports(projectRoot: string): Promise<ScanReport[]> {
  await loadConfig(projectRoot);
  const files = (await fs.readdir(path.join(stateDir(projectRoot), 'reports'))).filter(file => file.endsWith('.json'));
  const reports = await Promise.all(files.map(file => readReport(projectRoot, file.slice(0, -5))));
  return reports.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
async function readInstall(projectRoot: string, name: string): Promise<InstallRecord | undefined> {
  const file = recordPath(projectRoot, name);
  return await exists(file) ? InstallRecordSchema.parse(await readJson(file)) : undefined;
}
export async function listInstalls(projectRoot: string): Promise<InstallRecord[]> {
  await loadConfig(projectRoot);
  await recoverProject(projectRoot);
  const files = (await fs.readdir(path.join(stateDir(projectRoot), 'installs'))).filter(file => file.endsWith('.json'));
  const records = await Promise.all(files.map(file => readInstall(projectRoot, file.slice(0, -5))));
  return records.filter((record): record is InstallRecord => !!record);
}
async function recoverTarget(root: string, name: string): Promise<void> {
  const transactions = path.join(stateDir(root), 'transactions');
  for (const file of (await fs.readdir(transactions)).filter(file => /^scan-[a-z0-9-]+\.json$/.test(file))) {
    const transaction = await readJson(path.join(transactions, file)) as { state?: string; record?: unknown; previous?: unknown };
    if (transaction.state !== 'prepared') continue;
    const record = InstallRecordSchema.parse(transaction.record);
    if (record.name !== name) continue;
    const expected = path.join(path.resolve(root), '.agents/skills', safeName(name));
    if (record.target !== expected || record.snapshot !== path.join(stateDir(root), 'snapshots', safeId(record.scanId))) throw new SkillGateError('INVALID_TRANSACTION', 'Inconsistent local transaction.');
    await ensureDirectory(path.dirname(expected));
    const stat = await fs.lstat(expected).catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; });
    if (stat?.isSymbolicLink() && await fs.readlink(expected) === record.snapshot) {
      const checked = await inventory(record.snapshot);
      if (checked.fingerprint !== record.fingerprint || checked.coverage.limitsReached.length) throw new SkillGateError('SNAPSHOT_CHANGED', 'The snapshot of an interrupted installation has changed; manual recovery is required.');
      await atomicJson(recordPath(root, name), record);
      await atomicJson(path.join(transactions, file), { ...transaction, state: 'completed', recoveredAt: new Date().toISOString() });
    } else {
      await atomicJson(path.join(transactions, file), { ...transaction, state: 'aborted', recoveredAt: new Date().toISOString() });
    }
  }
}
export async function recoverProject(projectRoot: string): Promise<void> {
  const root = path.resolve(projectRoot); await loadConfig(root);
  const names = new Set<string>();
  for (const file of (await fs.readdir(path.join(stateDir(root), 'transactions'))).filter(file => /^scan-[a-z0-9-]+\.json$/.test(file))) {
    const item = await readJson(path.join(stateDir(root), 'transactions', file)) as { state?: string; record?: { name?: string } };
    if (item.state === 'prepared' && item.record?.name) names.add(safeName(item.record.name));
  }
  for (const name of names) await withTargetLock(root, name, () => recoverTarget(root, name));
}
export async function installScan(projectRoot: string, scanId: string, exception?: InstallException): Promise<InstallRecord> {
  const config = await loadConfig(projectRoot), report = await readReport(projectRoot, scanId);
  const root = path.resolve(projectRoot), destination = path.join(root, config.target, safeName(report.name));
  return withTargetLock(root, report.name, async () => {
    await recoverTarget(root, report.name);
    if (report.engineVersion !== ENGINE_VERSION || report.rulesVersion !== RULES_VERSION || report.policyVersion !== POLICY_VERSION || report.corpusVersion !== CORPUS_VERSION || report.profile !== config.profile) throw new SkillGateError('STALE_REPORT', 'Profile or engine changed. Scan the package again before installation.');
    if (report.decision !== decide(report.findings, report.coverage)) throw new SkillGateError('INVALID_REPORT', 'Decision does not match the policy.');
    // Preserve exception eligibility for complete packages in legacy French reports.
    if (report.coverage.limitsReached.some(limit => !limit.startsWith('Semantic analysis') && !limit.startsWith('Analyse sémantique'))) throw new SkillGateError('PACKAGE_INCOMPLETE', 'Package collection was truncated. An exception cannot activate a package with missing files.');
    if (exception) {
      exception = ExceptionSchema.parse(exception);
      if (exception.fingerprint !== report.fingerprint || path.resolve(exception.destination) !== destination || exception.confirmation !== exceptionConfirmation(report)) throw new SkillGateError('INVALID_EXCEPTION', 'Exception refused: report, fingerprint, destination, or confirmation does not match.');
    } else if (report.decision !== 'allow') throw new SkillGateError('DECISION_REQUIRED', 'Installation held. Review the evidence or confirm an exception for this exact fingerprint.');
    const quarantined = path.join(stateDir(root), 'quarantine', report.id, 'package');
    const current = await inventory(quarantined);
    if (current.fingerprint !== report.fingerprint || current.coverage.limitsReached.length || current.coverage.errors.length || current.coverage.inventoried !== report.manifest.length) throw new SkillGateError('SNAPSHOT_CHANGED', 'Files have changed since analysis. Installation refused; run the scan again.');
    const previous = await readInstall(root, report.name);
    await ensureDirectory(path.dirname(destination));
    if (await exists(destination)) {
      if (!previous || !(await fs.lstat(destination)).isSymbolicLink() || await fs.readlink(destination) !== previous.snapshot) throw new SkillGateError('UNMANAGED_TARGET', 'The target exists and is not an intact managed snapshot. No files were overwritten.');
    } else if (previous) throw new SkillGateError('TARGET_CHANGED', 'The active skill was removed outside SkillGate. Manual review is required.');
    if (previous?.fingerprint === report.fingerprint && previous.scanId === report.id) return previous;
    const snapshot = path.join(stateDir(root), 'snapshots', report.id);
    if (!await exists(snapshot)) {
      const staged = `${snapshot}-${randomUUID()}.staging`;
      await ensureDirectory(staged);
      const copied = await inventory(quarantined, staged);
      if (copied.fingerprint !== report.fingerprint || copied.coverage.limitsReached.length || copied.coverage.inventoried !== report.manifest.length || (await inventory(staged)).fingerprint !== report.fingerprint) { await fs.rm(staged, { recursive: true, force: true }); throw new SkillGateError('SNAPSHOT_CHANGED', 'A change was detected during preparation.'); }
      await fs.rename(staged, snapshot);
    }
    const prepared = await inventory(snapshot);
    if (prepared.fingerprint !== report.fingerprint || prepared.coverage.limitsReached.length || prepared.coverage.inventoried !== report.manifest.length) throw new SkillGateError('SNAPSHOT_CHANGED', 'The prepared snapshot has changed.');
    const at = new Date().toISOString(), record: InstallRecord = {
      schemaVersion: 1, name: report.name, target: destination, snapshot, scanId: report.id, fingerprint: report.fingerprint, source: report.source,
      status: exception ? 'installed_with_exception' : 'installed', installedAt: at,
      ...(exception ? { operatorDecision: exception } : {}),
      events: [...(previous?.events ?? []), { at, action: exception ? 'exception_accepted' : previous ? 'update_installed' : 'installed', scanId: report.id, detail: exception ? `Exception recorded by ${exception.operator}. Protection overridden for this fingerprint.` : 'Analyzed snapshot activated atomically.' }],
    };
    InstallRecordSchema.parse(record);
    const transaction = path.join(stateDir(root), 'transactions', `${report.id}.json`);
    await atomicJson(transaction, { state: 'prepared', record, previous: previous ?? null });
    const pointer = path.join(path.dirname(destination), `.${report.name}-${randomUUID()}.pending`);
    await fs.symlink(snapshot, pointer, 'dir');
    try { await fs.rename(pointer, destination); } catch (error) { await fs.rm(pointer, { force: true }); throw error; }
    try {
      await atomicJson(recordPath(root, report.name), record);
      await atomicJson(transaction, { state: 'completed', record, previous: previous ?? null });
    } catch {
      throw new SkillGateError('ACTIVATED_RECOVERY_REQUIRED', `The verified snapshot was activated, but its local record could not be finalized. Restore state file permissions and contents, then run skillgate list or skillgate doctor to recover.${previous ? ' The previous version remains stored in snapshots.' : ''}`);
    }
    return record;
  });
}
export async function addSkill(projectRoot: string, source: string, options: ScanOptions = {}): Promise<AddResult> {
  const report = await scanSkill(projectRoot, source, options);
  return report.decision === 'allow' ? { report, installation: await installScan(projectRoot, report.id) } : { report };
}
export async function updateSkill(projectRoot: string, name: string, options: ScanOptions = {}): Promise<AddResult> {
  await loadConfig(projectRoot);
  const installed = await readInstall(projectRoot, safeName(name));
  if (!installed) throw new SkillGateError('NOT_INSTALLED', 'This skill is not managed in this project.');
  return addSkill(projectRoot, installed.source.locator, { ...options, skill: name });
}
/** Removes expired uninstalled reports and their quarantines. Active snapshots and evidence stay. */
export async function pruneData(projectRoot: string, now = new Date()): Promise<{ removed: string[]; retained: number }> {
  const config = await loadConfig(projectRoot);
  return withTargetLock(projectRoot, 'retention', async () => {
    const active = new Set((await listInstalls(projectRoot)).map(record => record.scanId));
    const reports = await listReports(projectRoot), removed: string[] = [];
    for (const report of reports) {
      if (active.has(report.id) || now.getTime() - Date.parse(report.completedAt) < config.retentionDays * 86_400_000) continue;
      await withTargetLock(projectRoot, report.name, async () => {
        if ((await readInstall(projectRoot, report.name))?.scanId === report.id) return;
        await fs.rm(path.join(stateDir(projectRoot), 'quarantine', safeId(report.id)), { recursive: true, force: true });
        await fs.rm(reportPath(projectRoot, report.id)); removed.push(report.id);
      });
    }
    return { removed, retained: reports.length - removed.length };
  }, 'maintenance');
}
