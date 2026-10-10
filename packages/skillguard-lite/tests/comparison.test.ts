import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compareSkill, comparisonMetrics, comparisonTable, type ComparisonRow } from '../src/comparison.js';
import { loadBattery, loadSkill, ROOT, type AuditResult } from '../src/runner.js';
import type { TextReviewResult } from '../src/text-review.js';
import type { ChainSession } from '../src/types.js';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const dates = { startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:00.100Z' };
const textResult = (extra: Partial<TextReviewResult> = {}): TextReviewResult => ({
  kind: 'mocked-test', model: 'mock', verdict: 'BENIGN', reason: 'Synthetic metrics input.', complete: true,
  inputTokens: 10, outputTokens: 2, elapsedMs: 100, trace: [{ type: 'mock-text-evidence' }], ...dates, ...extra,
});
const auditResult = (extra: Partial<AuditResult> = {}): AuditResult => ({
  schemaVersion: 1, kind: 'mocked-test', provider: 'openai', skill: 'mock', skillSha256: 'mock', model: 'mock',
  ...dates, forkBlockNumber: 123, chainId: 43113, agentAddress: '0x7777777777777777777777777777777777777777',
  verdict: 'BENIGN', reason: 'Synthetic metrics input.', complete: true, baselineVerdict: 'BENIGN',
  tasks: [], violations: [], inputTokens: 30, outputTokens: 6, errors: [], protocol: {}, ...extra,
});
const row = (label: ComparisonRow['label'], text: TextReviewResult['verdict'], behavioral: AuditResult['verdict'], extra: Partial<ComparisonRow> = {}): ComparisonRow => ({
  skill: 'mock', skillSha256: 'mock', order: 'text-first', label,
  textReview: textResult({ verdict: text }), behavioral: auditResult({ verdict: behavioral }),
  behavioralElapsedMs: 200, consistentInput: true, ...extra,
});
const forbidden = async (): Promise<never> => { throw new Error('Comparison tests must not call a real or mock chain.'); };
const chain: ChainSession = { rpcUrl: 'http://mock.invalid', agentAddress: '0x7777777777777777777777777777777777777777', forkBlockNumber: 123, chainId: 43113, reset: forbidden, balance: forbidden, send: forbidden, close: forbidden };

test('paired metrics share exclusions and keep all observed tokens/time including unsuccessful rows', () => {
  const rows = [
    row('malicious', 'MALICIOUS', 'MALICIOUS'), row('malicious', 'BENIGN', 'MALICIOUS'),
    row('benign', 'MALICIOUS', 'BENIGN'), row('benign', 'BENIGN', 'BENIGN'),
    row('benign', 'BENIGN', 'ERROR', { behavioral: auditResult({ verdict: 'ERROR', complete: false }) }),
    row('malicious', 'MALICIOUS', 'MALICIOUS', { behavioral: auditResult({ verdict: 'MALICIOUS', complete: false }) }),
    row('malicious', 'MALICIOUS', 'MALICIOUS', { behavioral: auditResult({ verdict: 'MALICIOUS', baselineVerdict: 'MALICIOUS' }) }),
    row('benign', 'BENIGN', 'BENIGN', { consistentInput: false }),
    row('malicious', 'ERROR', 'MALICIOUS', { textReview: textResult({ verdict: 'ERROR', complete: false }) }),
  ];
  const metrics = comparisonMetrics(rows);
  assert.equal(metrics.total, 9);
  assert.equal(metrics.pairedScored, 4);
  assert.equal(metrics.unscored, 5);
  assert.equal(metrics.pairedAgreement, 2);
  assert.equal(metrics.pairedDisagreement, 2);
  assert.deepEqual([metrics.textReview.truePositives, metrics.textReview.trueNegatives, metrics.textReview.falsePositives, metrics.textReview.falseNegatives], [1, 1, 1, 1]);
  assert.deepEqual([metrics.skillGuard.truePositives, metrics.skillGuard.trueNegatives, metrics.skillGuard.falsePositives, metrics.skillGuard.falseNegatives], [2, 2, 0, 0]);
  assert.deepEqual(metrics.textReview.precision, { numerator: 1, denominator: 2, value: 0.5 });
  assert.deepEqual(metrics.skillGuard.recall, { numerator: 2, denominator: 2, value: 1 });
  assert.deepEqual(metrics.skillGuard.falsePositiveRate, { numerator: 0, denominator: 2, value: 0 });
  assert.equal(metrics.textReview.completed, 8);
  assert.equal(metrics.textReview.eligible, 8);
  assert.equal(metrics.skillGuard.completed, 7);
  assert.equal(metrics.skillGuard.eligible, 6);
  assert.deepEqual([metrics.textReview.elapsedMs, metrics.textReview.inputTokens, metrics.textReview.outputTokens], [900, 90, 18]);
  assert.deepEqual([metrics.skillGuard.elapsedMs, metrics.skillGuard.inputTokens, metrics.skillGuard.outputTokens], [1800, 270, 54]);
  assert.equal(metrics.textReview.usageMayBePartial, true);
  assert.equal(metrics.skillGuard.usageUncertainRows, 2);
  const table = comparisonTable(rows);
  assert.match(table, /Shared scored pairs: 4\/9/);
  assert.match(table, /complete \/ incomplete/);
  assert.match(table, /input mismatch/);
  assert.match(table, /returned input tokens 90/);
  assert.match(table, /not verified billing/);
  assert.match(table, /not a test of the ChatGPT application/);
});

test('zero denominators remain null and display N/A rather than invented percentages', () => {
  const empty = comparisonMetrics([]);
  assert.equal(empty.pairedScored, 0);
  for (const method of [empty.textReview, empty.skillGuard]) {
    assert.equal(method.precision.value, null);
    assert.equal(method.recall.value, null);
    assert.equal(method.falsePositiveRate.value, null);
    assert.equal(method.elapsedMs, 0);
    assert.equal(method.usageMayBePartial, false);
  }
  assert.equal(comparisonTable([]).match(/N\/A \(0 denominator\)/g)?.length, 6);
});

test('ties remain ties without a superiority claim', () => {
  const rows = [row('benign', 'BENIGN', 'BENIGN'), row('malicious', 'MALICIOUS', 'MALICIOUS')];
  const metrics = comparisonMetrics(rows);
  assert.equal(metrics.pairedAgreement, 2);
  assert.equal(metrics.pairedDisagreement, 0);
  assert.deepEqual(metrics.textReview.precision, metrics.skillGuard.precision);
  assert.deepEqual(metrics.textReview.recall, metrics.skillGuard.recall);
  assert.deepEqual(metrics.textReview.falsePositiveRate, metrics.skillGuard.falsePositiveRate);
  assert.match(comparisonTable(rows), /do not establish general superiority/);
});

test('both supplied method orders preserve native results and give the reviewer identical text/context without labels', async () => {
  const folder = path.join(ROOT, 'fixtures', 'malicious-overt');
  const skillText = await loadSkill(folder), { contacts, tasks } = await loadBattery();
  const protocol = { taskSha256: hash(JSON.stringify(tasks)), addressBookSha256: hash(JSON.stringify(contacts)) };
  for (const order of ['text-first', 'behavioral-first'] as const) {
    const calls: string[] = [];
    const nativeReview = textResult();
    const nativeAudit = auditResult({ skillSha256: hash(skillText), protocol });
    const result = await compareSkill({ folder, model: 'mock-model', chain, order,
      reviewer: async input => {
        calls.push('text');
        assert.deepEqual(Object.keys(input).sort(), ['contacts', 'model', 'skillText', 'tasks']);
        assert.deepEqual(input, { model: 'mock-model', skillText, contacts, tasks });
        return nativeReview;
      },
      auditor: async input => {
        calls.push('behavioral');
        assert.equal(input.folder, folder);
        assert.equal(input.chain, chain);
        assert.equal(input.model, 'mock-model');
        return nativeAudit;
      },
    });
    assert.deepEqual(calls, order === 'text-first' ? ['text', 'behavioral'] : ['behavioral', 'text']);
    assert.equal(result.textReview, nativeReview);
    assert.equal(result.behavioral, nativeAudit);
    assert.equal(result.consistentInput, true);
    assert.equal(result.skillSha256, hash(skillText));
    assert.ok(result.behavioralElapsedMs >= 0);
  }
});

test('a changed skill during a pair is preserved but excluded from both classifiers', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'skillguard-compare-'));
  const { contacts, tasks } = await loadBattery();
  try {
    await writeFile(path.join(folder, 'SKILL.md'), 'Original harmless payment text.\n');
    const result = await compareSkill({ folder, model: 'mock', chain, order: 'text-first',
      reviewer: async input => {
        assert.equal(input.skillText, 'Original harmless payment text.\n');
        await writeFile(path.join(folder, 'SKILL.md'), 'Changed harmless payment text.\n');
        return textResult();
      },
      auditor: async input => auditResult({ skillSha256: hash(await loadSkill(input.folder)), protocol: {
        taskSha256: hash(JSON.stringify(tasks)), addressBookSha256: hash(JSON.stringify(contacts)),
      } }),
    });
    assert.equal(result.consistentInput, false);
    assert.equal(comparisonMetrics([{ ...result, label: 'benign' }]).pairedScored, 0);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('changed task or address-book context is excluded even when the skill hash matches', async () => {
  const folder = path.join(ROOT, 'fixtures', 'benign-helpful');
  const skillText = await loadSkill(folder), { contacts, tasks } = await loadBattery();
  for (const changed of ['taskSha256', 'addressBookSha256']) {
    const result = await compareSkill({ folder, model: 'mock', chain, order: 'behavioral-first',
      reviewer: async () => textResult(),
      auditor: async () => auditResult({ skillSha256: hash(skillText), protocol: {
        taskSha256: hash(JSON.stringify(tasks)), addressBookSha256: hash(JSON.stringify(contacts)), [changed]: 'changed-context',
      } }),
    });
    assert.equal(result.consistentInput, false);
    assert.equal(comparisonMetrics([{ ...result, label: 'benign' }]).pairedScored, 0);
  }
});
