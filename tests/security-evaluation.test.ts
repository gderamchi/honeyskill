import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectionOutcome, snapshotFingerprint, corpusSkillRoot, SecurityReviewSchema, SECURITY_VERSION, type CaseResult, type EngineResult, type SecurityReview, type SecurityBenchmark } from '../packages/security-lab/src/types.js';
import { scoreCases, benchmarkMetrics, caseClassification, materializeSample, sha256, verifyBenchmarkMetrics } from '../packages/security-lab/src/benchmark.js';
import { reviewSecurity } from '../packages/security-lab/src/review.js';
import { securityBenchmarkHtml, securityBenchmarkMarkdown, securityReviewHtml } from '../packages/security-lab/src/report.js';

const stage = (alert: boolean, status: EngineResult['status'] = 'complete', engine: EngineResult['engine'] = 'native'): EngineResult => ({
  engine, version: engine === 'cisco' ? '2.2.2' : 'test', kind: engine === 'semantic' ? 'semantic' : 'static', status,
  durationMs: status === 'not_requested' ? 0 : 1, errors: status === 'complete' || status === 'not_requested' ? [] : ['Explicit test failure'],
  findings: alert ? [{ engine, rule: 'test', severity: 'high', title: 'Finding', explanation: 'Test data', evidence: [] }] : [],
});
const sample = (label: 'malicious' | 'benign' | 'unknown', id = 'case-1'): CaseResult['sample'] => ({ id, name: id, family: id, provenanceKind: 'research-control',
  groundTruth: { label, basis: 'Independent test labels', independentOfSkillGate: true },
  sourceUrl: 'https://example.org/source', sourceCommit: 'a'.repeat(40), originalPath: 'SKILL.md', sha256: sha256('text'), documentationUrl: 'https://example.org/paper', documentedThreatTypes: [],
  files: [{ originalPath: 'SKILL.md', fixturePath: 'SKILL.md.fixture', sha256: sha256('text'), bytes: 4 }], packageCompleteness: { status: 'complete-preserved-snapshot' } });
function derived(value: SecurityReview): SecurityReview {
  value.selectedEngines = value.engines.filter(engine => engine.status !== 'not_requested').map(engine => engine.engine);
  Object.assign(value, inspectionOutcome(value.engines, value.coverage.gaps));
  return value;
}
function review(alert = false, status: EngineResult['status'] = 'complete'): SecurityReview {
  const engines = [stage(alert, status), stage(false, 'complete', 'cisco'), stage(false, 'not_requested', 'semantic')];
  const manifest = [{ path: 'SKILL.md', size: 4, sha256: sha256('text'), executable: false }];
  return derived({ schemaVersion: 1, version: SECURITY_VERSION, id: 'test', name: 'skill', startedAt: '2026-10-11T00:00:00.000Z', durationMs: 1,
    fingerprint: snapshotFingerprint(manifest), manifest, selectedEngines: [], engines, ...inspectionOutcome(engines, []),
    coverage: { files: 1, readableFiles: 1, gaps: [], execution: 'not_executed', runtimeSupport: 'not_assessed' }, limitations: [] });
}
const item = (label: 'malicious' | 'benign' | 'unknown', alert: boolean, id: string): CaseResult => ({ sample: sample(label, id), review: review(alert) });
function benchmark(cases: CaseResult[]): SecurityBenchmark {
  const files = [{ path: 'packages/security-lab/src/types.ts', sha256: sha256('source fixture') }];
  return { schemaVersion: 1, version: SECURITY_VERSION, id: 'test', startedAt: '2026-10-11T00:00:00.000Z', durationMs: 1,
    corpusId: 'test', corpusSha256: 'a'.repeat(64), configuration: { semantic: false, threshold: 'medium', scannerVersion: '2.2.2', retries: 0 },
    freeze: { files, sha256: sha256(JSON.stringify(files)) }, cases, metrics: benchmarkMetrics(cases), limitations: [] };
}
test('independent labels yield all four cells; abstentions and unknown labels never become negatives', () => {
  const cases = [item('malicious', true, 'tp'), item('malicious', false, 'fn'), item('benign', true, 'fp'), item('benign', false, 'tn'), item('unknown', false, 'unknown'),
    { sample: sample('malicious', 'error'), error: 'FAIL' }, { ...item('malicious', false, 'partial'), review: review(false, 'partial') }];
  const result = scoreCases(cases);
  assert.deepEqual([result.tp, result.fn, result.fp, result.tn, result.unknown, result.incomplete], [1, 1, 1, 1, 1, 2]);
  assert.equal(result.accuracy, .5); assert.equal(result.recall, .5); assert.equal(result.precision, .5); assert.equal(result.falsePositiveRate, .5);
  assert.equal(result.abstentions.error, 1); assert.equal(result.abstentions.partial, 1);
  assert.deepEqual(result.labels, { malicious: 4, benign: 2, unknown: 1 });
  assert.equal(result.coverage.labelledRate, 4 / 6); assert.equal(result.coverage.maliciousRate, .5);
  assert.equal(result.endToEndDetectionFloor, .25);
  const partial = item('malicious', true, 'partial-package'); partial.sample.packageCompleteness.status = 'partial-text-only';
  assert.equal(scoreCases([partial]).abstentions.partialPackage, 1); assert.equal(caseClassification(partial), 'PARTIAL_PACKAGE');
});
test('one TP and 99 unsupported positives cannot masquerade as population-wide 100% recall', () => {
  const cases = [item('malicious', true, 'tp'), ...Array.from({ length: 99 }, (_, i) => ({ sample: sample('malicious', 'unsupported-' + i), review: review(false, 'unsupported') }))];
  const result = scoreCases(cases);
  assert.equal(result.recall, 1); assert.equal(result.coverage.maliciousRate, .01); assert.equal(result.endToEndDetectionFloor, .01);
  assert.equal(result.abstentions.unsupported, 99); assert.equal(result.fn, 0); assert.equal(result.tn, 0);
  assert.equal(caseClassification(cases[1]!), 'UNSUPPORTED');
  const html = securityBenchmarkHtml(benchmark(cases));
  assert.ok(html.includes('Conditional recall')); assert.ok(html.includes('1/100 (1.0%)')); assert.ok(html.includes('Detection floor'));
});
test('unknown labels are retained across exclusions and do not manufacture benign controls', () => {
  const unrelated = item('benign', false, 'not-independent'); unrelated.sample.groundTruth.independentOfSkillGate = false;
  const result = scoreCases([item('malicious', true, 'tp'), item('unknown', false, 'unknown'), unrelated, { sample: sample('unknown', 'failed-unknown'), error: 'FAIL' }]);
  assert.equal(result.recall, 1); assert.equal(result.precision, null); assert.equal(result.accuracy, null); assert.equal(result.falsePositiveRate, null);
  assert.equal(result.labels.unknown, 3); assert.equal(result.unknown, 2); assert.equal(result.incomplete, 1); assert.equal(result.tn, 0);
});
test('findings survive failed peers, while combined errors remain excluded and native scores remain measurable', () => {
  const value = review(true); value.engines[1] = stage(false, 'error', 'cisco'); derived(value);
  assert.equal(value.outcome, 'risk_detected'); assert.equal(value.inspectionComplete, false);
  const valueCase = { sample: sample('malicious'), review: value };
  assert.equal(scoreCases([valueCase]).abstentions.error, 1); assert.equal(scoreCases([valueCase], 'native').tp, 1);
  assert.equal(caseClassification(valueCase), 'ERROR');
});
test('not requested, missing engine, partial package and coverage gaps have distinct primary reasons', () => {
  const normal = item('malicious', false, 'normal');
  assert.equal(scoreCases([normal], 'semantic').abstentions.notRequested, 1);
  assert.equal(scoreCases([normal], 'semantic').endToEndDetectionFloor, null);
  assert.equal(scoreCases([normal], 'missing').abstentions.missingEngine, 1);
  const gap = item('malicious', false, 'gap'); gap.review!.coverage.gaps.push('Unsupported input file'); derived(gap.review!);
  assert.equal(scoreCases([gap]).abstentions.coverageGap, 1); assert.equal(caseClassification(gap), 'COVERAGE_GAP');
  const low = item('malicious', true, 'low'); low.review!.engines[0]!.findings[0]!.severity = 'low'; derived(low.review!);
  assert.equal(scoreCases([low]).fn, 1); assert.equal(caseClassification(low), 'FN');
});
test('family and source strata preserve case denominators without claiming independent campaigns', () => {
  const a = item('malicious', true, 'a'), b = item('malicious', false, 'b'), c = item('benign', false, 'c');
  a.sample.family = b.sample.family = 'shared-source-family';
  const metrics = benchmarkMetrics([a, b, c]);
  assert.equal(metrics['family:shared-source-family']!.attempted, 2);
  assert.deepEqual([metrics['family:shared-source-family']!.tp, metrics['family:shared-source-family']!.fn], [1, 1]);
  assert.equal(metrics['source:https://example.org/paper']!.attempted, 3);
});
test('corpus materialization verifies exact bytes and rejects traversal, symlinks and changed data', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-corpus-test-'));
  try {
    const stored = path.join(root, 'corpus'), target = path.join(root, 'out'); await fs.mkdir(stored); await fs.mkdir(target);
    await fs.writeFile(path.join(stored, 'SKILL.md.fixture'), 'text');
    await materializeSample(stored, sample('malicious'), target);
    assert.equal(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8'), 'text');
    const changed = sample('malicious'); changed.files[0]!.sha256 = '0'.repeat(64);
    await assert.rejects(materializeSample(stored, changed, path.join(root, 'out2')));
    const traversal = sample('malicious'); traversal.files[0]!.originalPath = '../escape';
    await assert.rejects(materializeSample(stored, traversal, path.join(root, 'out3')));
    await fs.symlink(path.join(stored, 'SKILL.md.fixture'), path.join(stored, 'linked.fixture'));
    const linked = sample('malicious'); linked.files[0]!.fixturePath = 'linked.fixture';
    await assert.rejects(materializeSample(stored, linked, path.join(root, 'out4')));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('real inventory and mocked scanner survive schema/JSON round trips with exact source binding', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-review-test-'));
  try {
    await fs.writeFile(path.join(root, 'SKILL.md'), '---\nname: test\ndescription: test\n---\nAnalyze text only.\n');
    await fs.writeFile(path.join(root, 'helper.py'), 'raise Exception("NEVER EXECUTE")\n');
    let quarantine = '';
    const result = await reviewSecurity(root, { ciscoProvider: async folder => {
      quarantine = folder; assert.notEqual(folder, root); assert.equal(await fs.readFile(path.join(folder, 'helper.py'), 'utf8'), 'raise Exception("NEVER EXECUTE")\n');
      return { status: 'complete', findings: [], errors: [], version: '2.2.2', durationMs: 1, analyzersUsed: [] };
    } });
    assert.equal(result.coverage.execution, 'not_executed');
    await assert.rejects(fs.stat(quarantine)); await assert.rejects(fs.stat(path.join(root, '.agents')));
    assert.equal(JSON.stringify(result).includes(root), false);
    // Deliberately reorder keys and manifest rows: identity must depend on content, not JSON insertion order.
    result.manifest = result.manifest.reverse().map(file => ({ executable: file.executable, sha256: file.sha256, size: file.size, path: file.path }));
    const parsed = SecurityReviewSchema.parse(JSON.parse(JSON.stringify(result)));
    assert.equal(snapshotFingerprint(parsed.manifest), result.fingerprint);
    const corpusSample = sample('unknown');
    corpusSample.sha256 = result.manifest.find(file => file.path === 'SKILL.md')!.sha256;
    corpusSample.files = result.manifest.map(file => ({ originalPath: file.path, fixturePath: file.path + '.fixture', sha256: file.sha256, bytes: file.size }));
    const evidence = benchmark([{ sample: corpusSample, review: parsed }]);
    assert.deepEqual(verifyBenchmarkMetrics(JSON.parse(JSON.stringify(evidence))), { valid: true, errors: [] });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('nested corpus entry points preserve original paths and expose files outside the selected skill root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-nested-corpus-'));
  try {
    await fs.writeFile(path.join(root, 'SKILL.md.fixture'), 'text');
    const nested = sample('malicious'); nested.originalPath = 'archive/skill/SKILL.md'; nested.files[0]!.originalPath = 'skill/SKILL.md';
    assert.equal(corpusSkillRoot(nested), 'skill');
    await materializeSample(root, nested, path.join(root, 'out'));
    assert.equal(await fs.readFile(path.join(root, 'out/skill/SKILL.md'), 'utf8'), 'text');
    const value = benchmark([{ sample: nested, review: review(false) }]);
    assert.equal(verifyBenchmarkMetrics(value).valid, true);
    nested.files.push({ originalPath: 'outside.txt', fixturePath: 'outside.txt.fixture', sha256: sha256('outside'), bytes: 7 });
    assert.equal(verifyBenchmarkMetrics(value).valid, false);
    value.cases[0]!.review!.coverage.gaps.push('Preserved files outside the selected skill root were not inspected.');
    derived(value.cases[0]!.review!); value.metrics = benchmarkMetrics(value.cases);
    assert.equal(verifyBenchmarkMetrics(value).valid, true);
    const ambiguous = structuredClone(nested); ambiguous.files.push({ ...nested.files[0]!, originalPath: 'SKILL.md', fixturePath: 'other.fixture' });
    assert.throws(() => corpusSkillRoot(ambiguous));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('verifier rejects forged snapshots, derived outcomes, selected engines and mismatched source bytes', () => {
  const base = benchmark([item('malicious', true, 'case')]);
  assert.equal(verifyBenchmarkMetrics(base).valid, true);
  const mutations: Array<(value: SecurityBenchmark) => void> = [
    value => { value.cases[0]!.review!.manifest = []; value.cases[0]!.review!.fingerprint = sha256('[]'); },
    value => { value.cases[0]!.review!.outcome = 'no_alert'; },
    value => { value.cases[0]!.review!.inspectionComplete = false; },
    value => { value.cases[0]!.review!.selectedEngines = ['native']; },
    value => { value.cases[0]!.review!.manifest[0]!.sha256 = '0'.repeat(64); value.cases[0]!.review!.fingerprint = snapshotFingerprint(value.cases[0]!.review!.manifest); },
    value => { value.cases[0]!.review!.manifest[0]!.size++; value.cases[0]!.review!.fingerprint = snapshotFingerprint(value.cases[0]!.review!.manifest); },
    value => { value.cases[0]!.review!.manifest[0]!.executable = true; value.cases[0]!.review!.fingerprint = snapshotFingerprint(value.cases[0]!.review!.manifest); },
    value => { value.cases[0]!.sample.files.push({ originalPath: 'omitted.py', fixturePath: 'omitted.py.fixture', sha256: sha256('file'), bytes: 4 }); },
    value => { value.cases[0]!.sample.packageCompleteness.status = 'partial-text-only'; value.metrics = benchmarkMetrics(value.cases); },
    value => { value.configuration.semantic = true; },
    value => { value.cases[0]!.review!.engines[1]!.version = 'fake-version'; },
    value => { value.cases[0]!.review!.engines[0]!.findings[0]!.evidence = [{ file: 'missing.py', verified: false }]; },
    value => { value.metrics.combined!.tp = 999; },
  ];
  for (const mutate of mutations) { const value = structuredClone(base); mutate(value); assert.equal(verifyBenchmarkMetrics(value).valid, false); }
});
test('verifier handles malformed records without crashes and validates all stored matrices', () => {
  for (const malformed of [null, 1, [], {}, { schemaVersion: 1, version: SECURITY_VERSION, cases: [null] }]) {
    assert.doesNotThrow(() => verifyBenchmarkMetrics(malformed)); assert.equal(verifyBenchmarkMetrics(malformed).valid, false);
  }
  const base = benchmark([item('malicious', true, 'case')]);
  for (const field of ['sample', 'review'] as const) {
    const value = structuredClone(base) as unknown as { cases: Record<string, unknown>[] };
    value.cases[0]![field] = null;
    assert.equal(verifyBenchmarkMetrics(value).valid, false);
  }
  const duplicate = structuredClone(base); duplicate.cases.push(structuredClone(duplicate.cases[0]!)); duplicate.metrics = benchmarkMetrics(duplicate.cases);
  assert.equal(verifyBenchmarkMetrics(duplicate).valid, false);
  const invalidUsage = structuredClone(base); invalidUsage.cases[0]!.review!.engines[0]!.usage = { inputTokens: 1, outputTokens: 1, totalTokens: 5 };
  assert.equal(verifyBenchmarkMetrics(invalidUsage).valid, false);
  const omittedMetric = structuredClone(base); delete omittedMetric.metrics['family:case'];
  assert.equal(verifyBenchmarkMetrics(omittedMetric).valid, false);
});
test('incomplete snapshots retain verified subsets but cannot claim complete analysis', () => {
  const value = benchmark([item('malicious', false, 'bounded')]);
  value.cases[0]!.sample.files.push({ originalPath: 'large.py', fixturePath: 'large.py.fixture', sha256: sha256('large'), bytes: 5 });
  value.cases[0]!.review!.coverage.gaps.push('large.py: size limit exceeded'); derived(value.cases[0]!.review!);
  value.metrics = benchmarkMetrics(value.cases);
  assert.equal(verifyBenchmarkMetrics(value).valid, true); assert.equal(value.metrics.combined!.fn, 0);
  assert.equal(value.metrics.combined!.abstentions.coverageGap, 1);
});
test('Cisco quotations are validated before portable report redaction (explicit mocked scanner)', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-redaction-test-'));
  const secret = 'sk-THIS_IS_ONLY_A_SYNTHETIC_SECURITY_TEST_KEY_1234';
  try {
    await fs.writeFile(path.join(root, 'SKILL.md'), '---\nname: test\ndescription: test\n---\n' + secret + '\n');
    const result = await reviewSecurity(root, { ciscoProvider: async folder => ({
      status: 'complete', version: '2.2.2', durationMs: 1, errors: [], analyzersUsed: [], findings: [{
        id: 'test', ruleId: 'TEST_SECRET', severity: 'high', category: 'test', analyzer: 'static', title: secret, description: folder + ' contains ' + secret,
        filePath: 'SKILL.md', lineNumber: 5, snippet: secret, evidenceStatus: 'verified',
      }],
    }) });
    const evidence = result.engines[1]!.findings[0]!.evidence[0]!;
    assert.equal(evidence.verified, true); assert.equal(evidence.redacted, true); assert.equal(evidence.excerpt, '[REDACTED]');
    for (const output of [JSON.stringify(result), securityReviewHtml(result)]) {
      assert.equal(output.includes(secret), false); assert.equal(output.includes(root), false);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('missing authorization is an error and larger readable packages are fully batched', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-semantic-limit-'));
  const ciscoProvider = async () => ({ status: 'complete' as const, findings: [], errors: [], version: '2.2.2', durationMs: 1, analyzersUsed: [] });
  try {
    await fs.writeFile(path.join(root, 'SKILL.md'), '---\nname: test\ndescription: test\n---\nAnalyze text only.\n');
    const missing = await reviewSecurity(root, { semantic: true, ciscoProvider });
    assert.equal(missing.engines[2]!.status, 'error'); assert.equal(missing.outcome, 'unverified');
    await fs.writeFile(path.join(root, 'long.txt'), 'ordinary source text\n'.repeat(4000));
    let calls = 0;
    const limited = await reviewSecurity(root, { semantic: true, ciscoProvider, semanticProvider: { name: 'explicit-test-provider', async analyze() { calls++; return { findings: [] }; } } });
    assert.ok(calls>1); assert.equal(limited.engines[2]!.status, 'complete'); assert.equal(limited.inspectionComplete, true);
    assert.equal(limited.engines[2]!.transport,'test-double'); assert.equal(limited.engines[2]!.batching!.completed,calls);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('HTML and Markdown treat hostile corpus content as literal text', () => {
  const value = review(true); value.name = '<script>alert(1)</script>'; value.engines[0]!.findings[0]!.title = '<img src=x onerror=alert(1)>';
  const html = securityReviewHtml(value);
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<img src=x')); assert.ok(html.includes("default-src 'none'"));
  const result = benchmark([{ sample: sample('malicious'), review: value }]);
  result.cases[0]!.sample.sourceUrl = 'javascript:alert(1)';
  assert.ok(!securityBenchmarkHtml(result).includes('href="javascript:'));
  result.cases[0]!.sample.name = '![tracking](https://attacker.example/pixel) | \n<script>evil</script>';
  result.limitations = ['![other](https://attacker.example/second)'];
  const markdown = securityBenchmarkMarkdown(result);
  assert.ok(markdown.includes(String.raw`\!\[tracking\]\(https://attacker\.example/pixel\)`));
  assert.ok(markdown.includes(String.raw`\!\[other\]\(https://attacker\.example/second\)`));
  assert.ok(!markdown.includes('<script>')); assert.ok(!markdown.includes('\n<script>'));
});

