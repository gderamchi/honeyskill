import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { safeRelative } from '../../core/src/acquisition.js';

export const SECURITY_VERSION = 'skillgate-security-v1';
const text = z.string().min(1).max(20_000);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^[a-f0-9]{64}$(?![\s\S])/);
const relativePath = z.string().min(1).max(2048).refine(value => { try { safeRelative(value); return true; } catch { return false; } }, 'Unsafe relative path');
const engineName = z.enum(['native', 'cisco', 'semantic']);
const ratio = z.number().min(0).max(1).nullable();
const usageSchema = z.object({ inputTokens: count, outputTokens: count, totalTokens: count }).strict()
  .refine(value => value.totalTokens === value.inputTokens + value.outputTokens, 'Inconsistent token usage');
const responseIdSchema = z.string().regex(/^resp_[A-Za-z0-9_-]{1,195}$(?![\s\S])/);
const requestSchema = z.object({ batch: z.number().int().positive(), inputSha256: digest,
  sourceIds: z.array(z.string().regex(/^s[0-9]{7}$/)).min(1).max(2048),
  status: z.enum(['complete','partial','error']), errors: z.array(text).max(100),
  responseId: responseIdSchema.optional(), model: text.optional(), usage: usageSchema.optional(),
}).strict();
export const EvidenceSchema = z.object({
  file: relativePath, line: z.number().int().positive().optional(), excerpt: text.optional(), verified: z.boolean(), redacted: z.boolean().optional(),
}).strict().refine(value => !value.verified || (value.line !== undefined && value.excerpt !== undefined), 'Verified evidence needs a line and excerpt');
export const SecurityFindingSchema = z.object({
  engine: engineName, rule: text, severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  title: text, explanation: text, evidence: z.array(EvidenceSchema).max(256),
}).strict();
export const EngineResultSchema = z.object({
  engine: engineName, version: text, kind: z.enum(['static', 'semantic']),
  status: z.enum(['complete', 'partial', 'error', 'unsupported', 'not_requested']),
  durationMs: z.number().nonnegative(), findings: z.array(SecurityFindingSchema).max(5000), errors: z.array(text).max(6000),
  responseId: responseIdSchema.optional(), model: text.optional(), usage: usageSchema.optional(),
  transport: z.enum(['openai-responses','test-double']).optional(), requests: z.array(requestSchema).min(1).max(128).optional(),
  batching: z.object({ strategy:z.literal('source-id-batches-v1'),planned:count,completed:count,readableFiles:count,sourceBytes:count,maxBatchBytes:count }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if ((value.engine === 'semantic') !== (value.kind === 'semantic')) fail('Incorrect engine kind');
  if (value.findings.some(finding => finding.engine !== value.engine)) fail('Finding attributed to another engine');
  if (value.status === 'complete' && value.errors.length) fail('Completed engine has errors');
  if (value.status === 'not_requested' && (value.findings.length || value.errors.length || value.durationMs !== 0)) fail('Unrequested engine has results');
  if (value.requests) {
    if(value.engine!=='semantic' || !value.batching || !value.transport) fail('Request ledger requires semantic batching provenance');
    if(value.requests.some((r,i)=>r.batch!==i+1 || (r.status==='complete' && r.errors.length))) fail('Inconsistent request sequence/status');
    const ids=value.requests.flatMap(r=>r.sourceIds);
    if(new Set(ids).size!==ids.length) fail('Repeated source coverage ID');
    const responses=value.requests.flatMap(r=>r.responseId?[r.responseId]:[]);
    if(new Set(responses).size!==responses.length) fail('Repeated provider response');
    if(value.batching?.planned!==value.requests.length || value.batching.completed!==value.requests.filter(r=>r.status==='complete').length) fail('Inconsistent batch coverage');
    if(value.status==='complete' && value.requests.some(r=>r.status!=='complete')) fail('Completed engine contains incomplete request');
    if(value.transport==='openai-responses' && value.requests.some(r=>r.status==='complete' && (!r.responseId || !r.usage || r.model!=='gpt-6-luna'))) fail('Missing live provider metadata');
    if(value.usage) {
      for(const key of ['inputTokens','outputTokens','totalTokens'] as const)
        if(value.usage[key]!==value.requests.reduce((n,r)=>n+(r.usage?.[key]??0),0)) fail('Request usage differs from aggregate');
    }
  } else if(value.batching) fail('Batch coverage lacks requests');
});
export const ManifestEntrySchema = z.object({ path: relativePath, size: count, sha256: digest, executable: z.boolean() }).strict();
export type SnapshotEntry = z.infer<typeof ManifestEntrySchema>;
/** Preserve acquisition's identity contract independently of object property and array order. */
export function snapshotFingerprint(manifest: SnapshotEntry[]): string {
  const canonical = [...manifest].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(entry => ({ path: entry.path, size: entry.size, sha256: entry.sha256, executable: entry.executable }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;
export type EngineResult = z.infer<typeof EngineResultSchema>;
export const isAlert = (finding: SecurityFinding): boolean => ['medium', 'high', 'critical'].includes(finding.severity);
export function inspectionOutcome(engines: EngineResult[], gaps: string[]): { inspectionComplete: boolean; outcome: 'risk_detected' | 'no_alert' | 'unverified' } {
  const active = engines.filter(engine => engine.status !== 'not_requested');
  const inspectionComplete = !!active.length && active.every(engine => engine.status === 'complete') && gaps.length === 0;
  return { inspectionComplete, outcome: active.some(engine => engine.findings.some(isAlert)) ? 'risk_detected' : inspectionComplete ? 'no_alert' : 'unverified' };
}
export const SecurityReviewSchema = z.object({
  schemaVersion: z.literal(1), version: z.literal(SECURITY_VERSION), id: text, name: text,
  startedAt: z.iso.datetime(), durationMs: z.number().nonnegative(), fingerprint: digest,
  manifest: z.array(ManifestEntrySchema).min(1).max(256),
  selectedEngines: z.array(engineName).min(1).max(3), engines: z.array(EngineResultSchema).min(1).max(3),
  inspectionComplete: z.boolean(), outcome: z.enum(['risk_detected', 'no_alert', 'unverified']),
  coverage: z.object({ files: count, readableFiles: count, gaps: z.array(text).max(6000),
    execution: z.literal('not_executed'), runtimeSupport: z.literal('not_assessed') }).strict(),
  limitations: z.array(text).max(100),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const paths = new Set(value.manifest.map(file => file.path));
  if (paths.size !== value.manifest.length || !paths.has('SKILL.md')) fail('Snapshot paths are duplicate or SKILL.md is absent');
  if (snapshotFingerprint(value.manifest) !== value.fingerprint) fail('Snapshot identity mismatch');
  if (new Set(value.engines.map(engine => engine.engine)).size !== value.engines.length
    || new Set(value.selectedEngines).size !== value.selectedEngines.length) fail('Duplicate engines');
  const selected = value.engines.filter(engine => engine.status !== 'not_requested').map(engine => engine.engine).sort();
  if (JSON.stringify(selected) !== JSON.stringify([...value.selectedEngines].sort())) fail('Selected engines differ from executed engine states');
  const derived = inspectionOutcome(value.engines, value.coverage.gaps);
  if (derived.inspectionComplete !== value.inspectionComplete || derived.outcome !== value.outcome) fail('Derived inspection outcome differs');
  if (value.coverage.files !== value.manifest.length || value.coverage.readableFiles > value.coverage.files
    || (value.coverage.readableFiles < value.coverage.files && !value.coverage.gaps.length)) fail('Inconsistent file coverage');
  for (const engine of value.engines) for (const finding of engine.findings)
    if (finding.evidence.some(evidence => !paths.has(evidence.file))) fail('Evidence points outside the recorded snapshot');
});
export type SecurityReview = z.infer<typeof SecurityReviewSchema>;

/** Derive the exact skill entry point without renaming the preserved package's files. */
export function corpusSkillRoot(sample: { originalPath: string; sha256: string; files: { originalPath: string; sha256: string }[] }): string {
  const matches = sample.files.filter(file => path.posix.basename(file.originalPath) === 'SKILL.md' && file.sha256 === sample.sha256
    && (sample.originalPath === file.originalPath || sample.originalPath.endsWith('/' + file.originalPath)));
  if (matches.length !== 1) throw new Error('Ambiguous or missing primary corpus file');
  const directory = path.posix.dirname(matches[0]!.originalPath);
  return directory === '.' ? '' : directory;
}
// Corpus provenance is data for scoring only; it is never passed to an analyzer.
export const CorpusSampleSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$(?![\s\S])/), name: text, family: text,
  provenanceKind: z.enum(['real-malware', 'upstream-control', 'synthetic', 'research-control']),
  groundTruth: z.object({ label: z.enum(['malicious', 'benign', 'unknown']), basis: text, independentOfSkillGate: z.boolean() }).passthrough(),
  sourceUrl: z.url(), sourceCommit: text, originalPath: relativePath, sha256: digest,
  documentationUrl: z.url(), documentedThreatTypes: z.array(text).max(100),
  files: z.array(z.object({ originalPath: relativePath, fixturePath: relativePath.refine(value => value.endsWith('.fixture')), sha256: digest, bytes: count }).passthrough()).min(1).max(256),
  packageCompleteness: z.object({ status: z.enum(['complete-preserved-snapshot', 'partial-text-only', 'partial-filtered']) }).passthrough(),
}).passthrough().superRefine((value, ctx) => {
  if (new Set(value.files.map(file => file.originalPath)).size !== value.files.length
    || new Set(value.files.map(file => file.fixturePath)).size !== value.files.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate corpus file paths' });
  try { corpusSkillRoot(value); }
  catch { ctx.addIssue({ code: 'custom', message: 'Primary identity differs from the recorded SKILL.md entry point' }); }
});
export type CorpusSample = z.infer<typeof CorpusSampleSchema>;
export const CorpusSchema = z.object({ schemaVersion: z.literal(1), corpusId: text, samples: z.array(CorpusSampleSchema).min(1).max(20000) }).passthrough();
export type Corpus = z.infer<typeof CorpusSchema>;
export const CaseResultSchema = z.object({ sample: CorpusSampleSchema, review: SecurityReviewSchema.optional(), error: text.optional() }).strict()
  .refine(value => (value.review !== undefined) !== (value.error !== undefined), 'Expected exactly one review or error');
export type CaseResult = z.infer<typeof CaseResultSchema>;
export const AbstentionsSchema = z.object({
  error: count, unsupported: count, partial: count, notRequested: count, missingEngine: count, partialPackage: count, coverageGap: count,
}).strict();
export type AbstentionReason = keyof z.infer<typeof AbstentionsSchema>;
export const ConfusionSchema = z.object({
  tp: count, fp: count, tn: count, fn: count, unknown: count, incomplete: count, attempted: count,
  abstentions: AbstentionsSchema,
  labels: z.object({ malicious: count, benign: count, unknown: count }).strict(),
  coverage: z.object({ complete: count, labelled: count, malicious: count, benign: count,
    rate: ratio, labelledRate: ratio, maliciousRate: ratio, benignRate: ratio }).strict(),
  precision: ratio, recall: ratio, falsePositiveRate: ratio, accuracy: ratio, endToEndDetectionFloor: ratio,
}).strict();
export type Confusion = z.infer<typeof ConfusionSchema>;
export const SecurityBenchmarkSchema = z.object({
  schemaVersion: z.literal(1), version: z.literal(SECURITY_VERSION), id: text, startedAt: z.iso.datetime(), durationMs: z.number().nonnegative(),
  corpusId: text, corpusSha256: digest,
  configuration: z.object({ semantic: z.boolean(), threshold: z.literal('medium'), scannerVersion: text, retries: z.literal(0) }).strict(),
  freeze: z.object({ files: z.array(z.object({ path: relativePath, sha256: digest }).strict()).min(1).max(1000), sha256: digest }).strict(),
  cases: z.array(CaseResultSchema).min(1).max(20000), metrics: z.record(z.string(), ConfusionSchema), limitations: z.array(text).max(100),
}).strict();
export type SecurityBenchmark = z.infer<typeof SecurityBenchmarkSchema>;

