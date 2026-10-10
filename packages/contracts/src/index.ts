import { z } from 'zod';

export const CategorySchema = z.enum(['FIN-01', 'FIN-02', 'FIN-03', 'FIN-04', 'FIN-05', 'FIN-06']);
export const SourceSchema = z.object({
  kind: z.enum(['local', 'github']), locator: z.string().max(2048),
  revision: z.string().max(100).optional(), subdirectory: z.string().max(1024).optional(),
});
export const EvidenceSchema = z.object({
  file: z.string().min(1).max(1024), line: z.number().int().positive(),
  endLine: z.number().int().positive(), excerpt: z.string().min(1).max(600),
  redacted: z.boolean().optional(),
});
export const FindingSchema = z.object({
  id: z.string(), category: CategorySchema,
  severity: z.enum(['medium', 'high', 'critical']), confidence: z.enum(['low', 'medium', 'high']),
  financialConsequence: z.string().max(1200), explanation: z.string().max(2000),
  evidence: z.array(EvidenceSchema).min(1).max(10),
  engine: z.enum(['native', 'semantic']), technique: z.string(), sources: z.array(z.string()),
  supported: z.boolean(),
});
export const CoverageSchema = z.object({
  status: z.enum(['complete_for_supported_checks', 'partial', 'failed']),
  inventoried: z.number().int().nonnegative(), read: z.number().int().nonnegative(),
  supported: z.number().int().nonnegative(), bytes: z.number().int().nonnegative(),
  ignored: z.array(z.object({ file: z.string(), reason: z.string() })),
  unresolved: z.array(z.string()), limitsReached: z.array(z.string()), errors: z.array(z.string()),
});
export const ManifestEntrySchema = z.object({
  path: z.string(), size: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/), executable: z.boolean(),
});
export const BehavioralSummarySchema = z.object({
  kind: z.enum(['actual-openai-local-fuji-fork-audit', 'mocked-test']), provider: z.string().min(1), model: z.string().min(1),
  skillSha256: z.string().regex(/^[a-f0-9]{64}$/), verdict: z.enum(['BENIGN', 'MALICIOUS', 'ERROR']),
  baselineVerdict: z.enum(['BENIGN', 'MALICIOUS', 'ERROR']), complete: z.boolean(), covered: z.boolean(),
  reason: z.string().max(4000), startedAt: z.string(), completedAt: z.string(),
  tasks: z.array(z.object({
    taskId: z.string().min(1), task: z.string().max(4000), baselineComplete: z.boolean(), skillComplete: z.boolean(),
    baselineTaskComplete: z.boolean(), skillTaskComplete: z.boolean(),
    baselineTransfers: z.number().int().nonnegative(), skillTransfers: z.number().int().nonnegative(),
  })).max(6),
  violations: z.array(z.object({
    taskId: z.string().min(1), task: z.string().max(4000), expectedRecipients: z.array(z.string()).min(1),
    actualRecipient: z.string(), amountAVAX: z.string(), transactionHash: z.string().optional(),
  })),
  inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(),
  errors: z.array(z.string()), limitations: z.array(z.string()),
  evidence: z.object({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
  chain: z.object({ chainId: z.number().int().positive(), forkBlockNumber: z.string() }).optional(),
});
export const ScanReportSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().regex(/^[a-z0-9-]{1,80}$/), name: z.string(),
  source: SourceSchema, fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  startedAt: z.string(), completedAt: z.string(), profile: z.enum(['static', 'hybrid', 'full']),
  engineVersion: z.string(), rulesVersion: z.string(), corpusVersion: z.string(), policyVersion: z.string(),
  analyses: z.array(z.object({
    engine: z.string(), stage: z.enum(['native', 'semantic', 'behavioral']).optional(),
    status: z.enum(['completed', 'failed', 'unavailable']), detail: z.string(),
    durationMs: z.number().nonnegative().optional(), model: z.string().optional(), responseId: z.string().optional(),
    usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), totalTokens: z.number().int().nonnegative() }).optional(),
  })),
  coverage: CoverageSchema, findings: z.array(FindingSchema),
  risk: z.enum(['none', 'detected']), decision: z.enum(['allow', 'hold', 'review']),
  capabilities: z.array(z.string()), durationMs: z.number().nonnegative(), limitations: z.array(z.string()),
  manifest: z.array(ManifestEntrySchema),
  behavioral: BehavioralSummarySchema.optional(),
});
export const ConfigSchema = z.object({
  version: z.literal(1), agent: z.literal('codex'), target: z.literal('.agents/skills'),
  profile: z.enum(['static', 'hybrid', 'full']), semanticConsent: z.boolean(), model: z.string().min(1).max(100),
  retentionDays: z.number().int().min(1).max(3650),
});
export const ExceptionSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), destination: z.string(),
  confirmation: z.string().min(1).max(300), operator: z.string().min(1).max(100), reason: z.string().max(1000).optional(),
});
export const InstallRecordSchema = z.object({
  schemaVersion: z.literal(1), name: z.string(), target: z.string(), snapshot: z.string(),
  status: z.enum(['installed', 'installed_with_exception']), scanId: z.string(), fingerprint: z.string(),
  source: SourceSchema, installedAt: z.string(),
  operatorDecision: ExceptionSchema.optional(),
  events: z.array(z.object({ at: z.string(), action: z.string(), scanId: z.string(), detail: z.string() })),
});
export const ResearchSourceSchema = z.object({
  id: z.string(), title: z.string(), publisher: z.string(), url: z.string().url(), publishedAt: z.string().nullable(),
  accessedAt: z.string(), summary: z.string(), limitations: z.array(z.string()),
  status: z.enum(['consulted', 'unavailable']), kind: z.enum(['research', 'documentation', 'regulation', 'comparison']), section: z.string(),
});
export const TechniqueCardSchema = z.object({
  id: z.string(), title: z.string(), category: CategorySchema, source_id: z.string().nullable(),
  kind: z.enum(['documented', 'synthetic-hypothesis']), section: z.string(),
  confirmation: z.string(), claimedFunction: z.string(), mechanism: z.string(), asset: z.string(),
  limitations: z.array(z.string()), candidateRule: z.string(), fixtures: z.array(z.string()),
  contextualSources: z.array(z.string()).optional(),
});
export type Source = z.infer<typeof SourceSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Coverage = z.infer<typeof CoverageSchema>;
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
export type BehavioralSummary = z.infer<typeof BehavioralSummarySchema>;
export type ScanReport = z.infer<typeof ScanReportSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type InstallRecord = z.infer<typeof InstallRecordSchema>;
export type InstallException = z.infer<typeof ExceptionSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type TechniqueCard = z.infer<typeof TechniqueCardSchema>;
