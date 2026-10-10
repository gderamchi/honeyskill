import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import type { BehavioralProvider } from '../../core/src/index.js';
import type { BehavioralSummary } from '../../contracts/src/index.js';
import { auditSkill, loadSkill, type AuditResult } from './runner.js';
import { checkPrerequisites } from './prerequisites.js';
export { checkPrerequisites, resolveAnvilExecutable } from './prerequisites.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const limitations = [
  'Only native AVAX recipient substitution is exercised by the fixed six-task, send-only agent on an owned local Fuji fork.',
  'No upstream scripts, SDKs, HTTP integrations, browser challenges or referenced files are executed; package/dependency coverage is assessed separately by the installer.',
  'All address-book contacts and addresses written in each task are allowed; other threats and untested triggers are outside this behavioral test.',
  'Returned tokens are observed API usage, not verified billing; incomplete or failed requests may have unreported usage.',
];

export function summarizeBehavioralAudit(audit: AuditResult): BehavioralSummary {
  const covered = audit.complete && audit.baselineVerdict === 'BENIGN' && audit.tasks.length === 6 && audit.tasks.every(task =>
    task.baseline.completed && task.baselineReachedExpectedRecipients && task.baselineViolations.length === 0 &&
    task.withSkill.completed && (task.skillReachedExpectedRecipients || task.violations.length > 0));
  return {
    kind: audit.kind, provider: audit.provider, model: audit.model, skillSha256: audit.skillSha256,
    verdict: audit.verdict, baselineVerdict: audit.baselineVerdict, complete: audit.complete, covered,
    reason: !covered && audit.verdict === 'BENIGN' ? `${audit.reason} Required payment behavior was not exercised in every task; installation remains unverified.` : audit.reason,
    startedAt: audit.startedAt, completedAt: audit.completedAt,
    tasks: audit.tasks.map(task => ({
      taskId: task.task.id, task: task.task.prompt,
      baselineComplete: task.baseline.completed, skillComplete: task.withSkill.completed,
      baselineTaskComplete: task.baselineReachedExpectedRecipients, skillTaskComplete: task.skillReachedExpectedRecipients,
      baselineTransfers: task.baseline.sends.filter(send => send.status === 'executed').length,
      skillTransfers: task.withSkill.sends.filter(send => send.status === 'executed').length,
    })),
    violations: audit.violations.map(({ taskId, task, expectedRecipients, actualRecipient, amountAVAX, transactionHash }) => ({
      taskId, task, expectedRecipients, actualRecipient, amountAVAX, ...(transactionHash ? { transactionHash } : {}),
    })),
    inputTokens: audit.inputTokens, outputTokens: audit.outputTokens,
    errors: [...audit.errors], limitations: [...limitations],
    chain: { chainId: audit.chainId, forkBlockNumber: String(audit.forkBlockNumber) },
  };
}

/** Uses the existing reference agent unchanged; evidence is private local JSON outside the skill package. */
export function createBehavioralProvider(options: {
  evidenceDirectory: string;
  auditor?: typeof auditSkill;
  preflight?: typeof checkPrerequisites;
  progress?: (text: string) => void;
}): BehavioralProvider {
  return {
    name: 'SkillGuard-Lite behavioral audit',
    async analyze(input): Promise<BehavioralSummary> {
      const startedAt = new Date().toISOString();
      const before = await loadSkill(input.folder);
      if (hash(before) !== input.skillSha256) throw new Error('Quarantined SKILL.md changed before behavioral analysis. No model request was made.');
      const readiness = await (options.preflight ?? checkPrerequisites)();
      if (!readiness.ready) return {
        kind: options.auditor ? 'mocked-test' : 'actual-openai-local-fuji-fork-audit', provider: 'openai', model: input.model,
        skillSha256: input.skillSha256, verdict: 'ERROR', baselineVerdict: 'ERROR', complete: false, covered: false,
        reason: readiness.errors.join(' '), startedAt, completedAt: new Date().toISOString(), tasks: [], violations: [],
        inputTokens: 0, outputTokens: 0, errors: readiness.errors, limitations: [...limitations],
      };
      const directory = path.resolve(options.evidenceDirectory);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const details = await lstat(directory);
      if (!details.isDirectory() || details.isSymbolicLink()) throw new Error('Behavioral evidence directory must be a real local directory.');
      const evidencePath = path.join(directory, `behavioral-audit-${randomUUID()}.json`);
      // Reserve writable evidence before model calls. A random filename is independent of skill-controlled names.
      const file = await open(evidencePath, 'wx', 0o600);
      const persist = async (record: unknown) => {
        const serialized = JSON.stringify(record, null, 2) + '\n';
        await file.truncate(0); await file.write(serialized, 0, 'utf8'); await file.sync();
        return { path: evidencePath, sha256: hash(serialized) };
      };
      try {
        await persist({ kind: 'behavioral-audit-in-progress', startedAt, fingerprint: input.fingerprint, skillSha256: input.skillSha256, model: input.model, complete: false });
        const audit = await (options.auditor ?? auditSkill)({ folder: input.folder, model: input.model, progress: options.progress });
        const evidence = await persist(audit);
        const summary = summarizeBehavioralAudit(audit);
        let unchanged = false;
        try { unchanged = audit.skillSha256 === input.skillSha256 && hash(await loadSkill(input.folder)) === input.skillSha256; } catch { /* A removed/invalid snapshot is also unverified. */ }
        if (!unchanged) {
          summary.verdict = 'ERROR'; summary.complete = false; summary.covered = false;
          summary.reason = 'SKILL.md changed during behavioral analysis; the observed audit cannot authorize this snapshot.';
          summary.errors.push(summary.reason);
        }
        return { ...summary, evidence };
      } catch {
        const reason = 'Behavioral audit failed before a complete result could be retained. No installation can be authorized; request usage may be unknown.';
        const evidence = await persist({ kind: 'behavioral-audit-error', startedAt, completedAt: new Date().toISOString(), fingerprint: input.fingerprint, skillSha256: input.skillSha256, model: input.model, complete: false, error: reason });
        return {
          kind: options.auditor ? 'mocked-test' : 'actual-openai-local-fuji-fork-audit', provider: 'openai', model: input.model,
          skillSha256: input.skillSha256, verdict: 'ERROR', baselineVerdict: 'ERROR', complete: false, covered: false,
          reason, startedAt, completedAt: new Date().toISOString(), tasks: [], violations: [], inputTokens: 0, outputTokens: 0,
          errors: [reason], limitations: [...limitations], evidence,
        };
      } finally { await file.close(); }
    },
  };
}
