import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { safeRelative } from '../../core/src/acquisition.js';
import { reviewSecurity, publicError, type SecurityOptions } from './review.js';
import { CorpusSchema, SecurityBenchmarkSchema, SECURITY_VERSION, isAlert, inspectionOutcome, corpusSkillRoot, type CorpusSample, type SecurityBenchmark, type CaseResult, type Confusion, type AbstentionReason } from './types.js';

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function selectedStages(item: CaseResult, engine: string) {
  return item.review?.engines.filter(stage => engine === 'combined' ? item.review!.selectedEngines.includes(stage.engine) : stage.engine === engine) ?? [];
}
/** Mutually exclusive primary reason. All stage errors remain in the case's detailed evidence. */
export function abstentionReason(item: CaseResult, engine = 'combined'): AbstentionReason | undefined {
  if (!item.review || item.error) return 'error';
  const stages = selectedStages(item, engine);
  if (!stages.length || (engine === 'combined' && stages.length !== item.review.selectedEngines.length)) return 'missingEngine';
  if (stages.some(stage => stage.status === 'error')) return 'error';
  if (stages.some(stage => stage.status === 'unsupported')) return 'unsupported';
  if (stages.some(stage => stage.status === 'partial')) return 'partial';
  if (stages.some(stage => stage.status === 'not_requested')) return 'notRequested';
  if (item.sample.packageCompleteness.status !== 'complete-preserved-snapshot') return 'partialPackage';
  if (item.review.coverage.gaps.length) return 'coverageGap';
  return undefined;
}
export function scoreCases(cases: CaseResult[], engine = 'combined'): Confusion {
  const result: Confusion = {
    tp: 0, fp: 0, tn: 0, fn: 0, unknown: 0, incomplete: 0, attempted: cases.length,
    abstentions: { error: 0, unsupported: 0, partial: 0, notRequested: 0, missingEngine: 0, partialPackage: 0, coverageGap: 0 },
    labels: { malicious: 0, benign: 0, unknown: 0 },
    coverage: { complete: 0, labelled: 0, malicious: 0, benign: 0, rate: null, labelledRate: null, maliciousRate: null, benignRate: null },
    precision: null, recall: null, falsePositiveRate: null, accuracy: null, endToEndDetectionFloor: null,
  };
  for (const item of cases) {
    const label = item.sample.groundTruth.independentOfSkillGate ? item.sample.groundTruth.label : 'unknown';
    result.labels[label]++;
    const reason = abstentionReason(item, engine);
    if (reason) { result.incomplete++; result.abstentions[reason]++; continue; }
    result.coverage.complete++;
    if (label === 'unknown') { result.unknown++; continue; }
    result.coverage.labelled++; result.coverage[label]++;
    const detected = selectedStages(item, engine).some(stage => stage.findings.some(isAlert));
    if (label === 'malicious') detected ? result.tp++ : result.fn++;
    else detected ? result.fp++ : result.tn++;
  }
  const ratio = (a: number, b: number) => b ? a / b : null;
  // With positives only, precision/accuracy would be tautological and not estimate a classifier's quality.
  const bothClasses = result.tp + result.fn > 0 && result.fp + result.tn > 0;
  result.precision = bothClasses ? ratio(result.tp, result.tp + result.fp) : null;
  result.recall = ratio(result.tp, result.tp + result.fn);
  result.falsePositiveRate = ratio(result.fp, result.fp + result.tn);
  result.accuracy = bothClasses ? ratio(result.tp + result.tn, result.tp + result.fp + result.tn + result.fn) : null;
  result.coverage.rate = ratio(result.coverage.complete, result.attempted);
  result.coverage.labelledRate = ratio(result.coverage.labelled, result.labels.malicious + result.labels.benign);
  result.coverage.maliciousRate = ratio(result.coverage.malicious, result.labels.malicious);
  result.coverage.benignRate = ratio(result.coverage.benign, result.labels.benign);
  // A lower bound on measured detection across all labelled positives, not a reclassification of abstentions as FN.
  result.endToEndDetectionFloor = result.abstentions.notRequested === result.attempted ? null : ratio(result.tp, result.labels.malicious);
  return result;
}
export function benchmarkMetrics(cases: CaseResult[]): Record<string, Confusion> {
  const result: Record<string, Confusion> = {};
  for (const engine of ['native', 'cisco', 'semantic', 'combined']) result[engine] = scoreCases(cases, engine);
  for (const provenance of [...new Set(cases.map(item => item.sample.provenanceKind))].sort()) result[`combined:${provenance}`] = scoreCases(cases.filter(item => item.sample.provenanceKind === provenance));
  for (const family of [...new Set(cases.map(item => item.sample.family))].sort()) result[`family:${family}`] = scoreCases(cases.filter(item => item.sample.family === family));
  for (const source of [...new Set(cases.map(item => item.sample.documentationUrl))].sort()) result[`source:${source}`] = scoreCases(cases.filter(item => item.sample.documentationUrl === source));
  return result;
}
export function caseClassification(item: CaseResult): string {
  const reason = abstentionReason(item);
  if (reason) return ({ error: 'ERROR', unsupported: 'UNSUPPORTED', partial: 'PARTIAL_ANALYSIS', notRequested: 'NOT_REQUESTED',
    missingEngine: 'MISSING_ENGINE', partialPackage: 'PARTIAL_PACKAGE', coverageGap: 'COVERAGE_GAP' })[reason];
  if (item.sample.groundTruth.label === 'unknown' || !item.sample.groundTruth.independentOfSkillGate) return 'UNLABELLED';
  const detected = selectedStages(item, 'combined').some(stage => stage.findings.some(isAlert));
  return item.sample.groundTruth.label === 'malicious' ? detected ? 'TP' : 'FN' : detected ? 'FP' : 'TN';
}

/** The original filenames exist only in an isolated temporary analysis directory. */
export async function materializeSample(corpusRoot: string, sample: CorpusSample, destination: string): Promise<void> {
  const root = await fs.realpath(corpusRoot), seen = new Set<string>();
  for (const file of sample.files) {
    const original = safeRelative(file.originalPath), fixture = safeRelative(file.fixturePath);
    if (!fixture.endsWith('.fixture') || seen.has(original) || file.bytes > 256 * 1024) throw new Error('Invalid or duplicate corpus file.');
    seen.add(original);
    const target = path.join(destination, original), stored = path.join(root, fixture);
    const real = await fs.realpath(stored);
    if (!real.startsWith(root + path.sep) || real !== stored) throw new Error('Corpus symlink or path escape refused.');
    const handle = await fs.open(stored, constants.O_RDONLY | constants.O_NOFOLLOW);
    let data: Buffer;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size !== file.bytes) throw new Error('Invalid corpus file.');
      data = await handle.readFile();
    } finally { await handle.close(); }
    if (data.length !== file.bytes || sha256(data) !== file.sha256) throw new Error('Corpus bytes differ from frozen manifest.');
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await fs.writeFile(target, data, { flag: 'wx', mode: 0o600 });
  }
  const primary = path.posix.join(corpusSkillRoot(sample), 'SKILL.md');
  if (!seen.has(primary) || sha256(await fs.readFile(path.join(destination, primary))) !== sample.sha256) throw new Error('SKILL.md does not match corpus identity.');
}

async function sourceFreeze(repositoryRoot: string): Promise<SecurityBenchmark['freeze']> {
  const files: { path: string; sha256: string }[] = [];
  for (const relative of ['packages/security-lab/src', 'packages/security-policy/src', 'packages/core/src', 'packages/contracts/src']) {
    for (const file of (await fs.readdir(path.join(repositoryRoot, relative))).filter(file => file.endsWith('.ts')).sort()) {
      const name = `${relative}/${file}`; files.push({ path: name, sha256: sha256(await fs.readFile(path.join(repositoryRoot, name))) });
    }
  }
  for (const name of ['package.json', 'pnpm-lock.yaml', 'apps/cli/src/security.ts', 'packages/skillguard-lite/src/agent.ts']) files.push({ path: name, sha256: sha256(await fs.readFile(path.join(repositoryRoot, name))) });
  return { files, sha256: sha256(JSON.stringify(files)) };
}

export async function runSecurityBenchmark(manifestPath: string, options: SecurityOptions & {
  repositoryRoot: string; output: string; limit?: number; progress?: (completed: number, total: number, id: string) => void;
}): Promise<SecurityBenchmark> {
  const manifestBytes = await fs.readFile(manifestPath), corpus = CorpusSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
  if (new Set(corpus.samples.map(sample => sample.id)).size !== corpus.samples.length) throw new Error('Duplicate corpus IDs.');
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1)) throw new Error('Limit must be a positive integer.');
  const selected = corpus.samples.slice(0, options.limit), started = performance.now();
  // Reserve a fresh output directory; previous failures and measurements are never overwritten.
  await fs.mkdir(options.output, { recursive: false, mode: 0o700 });
  const result: SecurityBenchmark = { schemaVersion: 1, version: SECURITY_VERSION, id: `benchmark-${randomUUID()}`,
    startedAt: new Date().toISOString(), durationMs: 0, corpusId: corpus.corpusId, corpusSha256: sha256(manifestBytes),
    configuration: { semantic: !!options.semantic, threshold: 'medium', scannerVersion: '2.2.2', retries: 0 },
    freeze: await sourceFreeze(options.repositoryRoot), cases: [], metrics: {},
    limitations: ['Development external evaluation, not a blind holdout or an independent replication.',
      'Source-study malware labels are independent of HoneySkill; authenticity to original incident bytes can remain unverified.',
      'Complete preserved package snapshots only enter TP/FP/TN/FN; partial packages, errors and missing selected engines remain separate.',
      'Official upstream controls with unknown labels do not count as true negatives.',
      'Family/source groups are not necessarily independent campaigns. Model training contamination is unknown.',
      'Static package inspection; no acquired scripts, real wallets, malware endpoints or public signed transactions were executed.',
      'Runtime prevention is evaluated separately on typed actions. These inspection scores do not measure prevention.'] };
  await fs.writeFile(path.join(options.output, 'freeze.json'), JSON.stringify({ ...result, cases: undefined, metrics: undefined, selectedIds: selected.map(sample => sample.id) }, null, 2), { flag: 'wx' });
  let cursor = 0, completed = 0;
  const cases: CaseResult[] = new Array(selected.length);
  const worker = async () => {
    while (cursor < selected.length) {
      const index = cursor++, sample = selected[index]!;
      const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'honeyskill-corpus-'));
      let item: CaseResult;
      try {
        await materializeSample(path.dirname(manifestPath), sample, temporary);
        const skillRoot = corpusSkillRoot(sample);
        const review = await reviewSecurity(path.join(temporary, skillRoot), options);
        review.name = sample.name;
        if (sample.packageCompleteness.status !== 'complete-preserved-snapshot') {
          review.coverage.gaps.push('Only part of the source package is preserved in this case.');
        }
        if (skillRoot && sample.files.some(file => !file.originalPath.startsWith(skillRoot + '/')))
          review.coverage.gaps.push('Preserved files outside the selected skill root were not inspected.');
        Object.assign(review, inspectionOutcome(review.engines, review.coverage.gaps));
        item = { sample, review };
      } catch (error) { item = { sample, error: publicError(error) }; }
      finally { await fs.rm(temporary, { recursive: true, force: true }); }
      cases[index] = item;
      await fs.writeFile(path.join(options.output, `${sample.id}.json`), JSON.stringify(item, null, 2), { flag: 'wx', mode: 0o600 });
      options.progress?.(++completed, selected.length, sample.id);
    }
  };
  await Promise.all([worker(), worker()]);
  result.cases = cases; result.durationMs = performance.now() - started; result.metrics = benchmarkMetrics(cases);
  if ((await sourceFreeze(options.repositoryRoot)).sha256 !== result.freeze.sha256) result.limitations.push('Source files changed during this run. Do not use it as a frozen-code evaluation.');
  await fs.writeFile(path.join(options.output, 'benchmark.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  return result;
}

export function verifyBenchmarkMetrics(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  // Parse before dereferencing anything. The input is a user-supplied JSON artifact, not a trusted TypeScript value.
  const parsed = SecurityBenchmarkSchema.safeParse(input);
  if (!parsed.success) return { valid: false, errors: ['Invalid benchmark record schema or inconsistent review.'] };
  const result = parsed.data;
  if (new Set(result.cases.map(item => item.sample.id)).size !== result.cases.length) errors.push('Duplicate case identities.');
  if (new Set(result.freeze.files.map(file => file.path)).size !== result.freeze.files.length) errors.push('Duplicate source freeze paths.');
  if (sha256(JSON.stringify(result.freeze.files)) !== result.freeze.sha256) errors.push('Source freeze digest mismatch.');
  if (!isDeepStrictEqual(benchmarkMetrics(result.cases), result.metrics)) errors.push('Confusion matrices differ from recorded cases.');
  for (const item of result.cases) {
    if (!item.review) continue;
    const review = item.review, expected = ['native', 'cisco', ...(result.configuration.semantic ? ['semantic'] : [])].sort();
    if (!isDeepStrictEqual([...review.selectedEngines].sort(), expected)
      || !isDeepStrictEqual(review.engines.map(stage => stage.engine).sort(), ['cisco', 'native', 'semantic'])) errors.push(`Engine configuration mismatch: ${item.sample.id}`);
    const cisco = review.engines.find(stage => stage.engine === 'cisco');
    if (cisco?.status === 'complete' && cisco.version !== result.configuration.scannerVersion) errors.push(`Scanner version mismatch: ${item.sample.id}`);
    const skillRoot = corpusSkillRoot(item.sample), prefix = skillRoot ? skillRoot + '/' : '';
    const sourceFiles = new Map(item.sample.files.filter(file => file.originalPath.startsWith(prefix))
      .map(file => [file.originalPath.slice(prefix.length), file]));
    for (const file of review.manifest) {
      const source = sourceFiles.get(file.path);
      if (!source || source.sha256 !== file.sha256 || source.bytes !== file.size || file.executable)
        errors.push(`Snapshot differs from corpus file: ${item.sample.id}`);
    }
    // Bounded inventory can omit files, but only an explicitly incomplete record may do so.
    if (review.manifest.length !== sourceFiles.size && !review.coverage.gaps.length) errors.push(`Snapshot omits corpus files without a coverage gap: ${item.sample.id}`);
    if (sourceFiles.size !== item.sample.files.length && !review.coverage.gaps.length) errors.push(`Files outside selected skill root lack a coverage gap: ${item.sample.id}`);
    if (item.sample.packageCompleteness.status !== 'complete-preserved-snapshot' && !review.coverage.gaps.length)
      errors.push(`Partial corpus package lacks a coverage gap: ${item.sample.id}`);
  }
  return { valid: !errors.length, errors };
}
