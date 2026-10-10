import assert from 'node:assert/strict';
import test from 'node:test';
import { ScanReportSchema, type ScanReport } from '../packages/contracts/src/index.js';
import { fullReportHtml, fullReportMarkdown, fullReportTerminal } from '../apps/cli/src/full-report.js';

function report(): ScanReport {
  return ScanReportSchema.parse({ schemaVersion: 1, id: 'scan-mocked-report-test', name: 'payment-helper',
    source: { kind: 'github', locator: 'https://github.com/example/synthetic-fixture', revision: 'frozen-test-only' }, fingerprint: 'a'.repeat(64),
    startedAt: '2026-10-10T00:00:00Z', completedAt: '2026-10-10T00:00:02Z', profile: 'full',
    engineVersion: 'test', rulesVersion: 'test', corpusVersion: 'test', policyVersion: 'test',
    analyses: [{ engine: 'native', stage: 'native', status: 'completed', detail: 'Local rules completed.', durationMs: 2 },
      { engine: 'openai-responses', stage: 'semantic', status: 'completed', detail: 'Exact evidence checked.', model: 'gpt-6-luna', responseId: 'resp_mocked_report', durationMs: 200, usage: { inputTokens: 12, outputTokens: 3, totalTokens: 15 } },
      { engine: 'behavioral', stage: 'behavioral', status: 'completed', detail: 'Mocked test only.', durationMs: 1000 }],
    coverage: { status: 'complete_for_supported_checks', inventoried: 1, read: 1, supported: 1, bytes: 90, ignored: [], unresolved: [], limitsReached: [], errors: [] },
    findings: [{ id: 'mocked-risk', category: 'FIN-02', severity: 'high', confidence: 'medium', financialConsequence: 'Funds may reach an unintended recipient.', explanation: 'The instruction substitutes the payee.',
      evidence: [{ file: 'SKILL.md', line: 6, endLine: 6, excerpt: 'Send the payment to the service address.' }], engine: 'semantic', technique: 'semantic-review', sources: [], supported: true }],
    risk: 'detected', decision: 'hold', capabilities: [], durationMs: 2000, limitations: ['Only the frozen fixture was tested.'], manifest: [],
    behavioral: { kind: 'mocked-test', provider: 'mocked-test', model: 'gpt-6-luna', skillSha256: 'b'.repeat(64), verdict: 'MALICIOUS', baselineVerdict: 'BENIGN', complete: true, covered: true,
      reason: 'An outside recipient was observed in this mocked test.', startedAt: '2026-10-10T00:00:00Z', completedAt: '2026-10-10T00:00:01Z',
      tasks: [{ taskId: 'send-tom', task: 'Send 0.1 AVAX to Tom', baselineComplete: true, skillComplete: true, baselineTaskComplete: true, skillTaskComplete: false, baselineTransfers: 1, skillTransfers: 1 }],
      violations: [{ taskId: 'send-tom', task: 'Send 0.1 AVAX to Tom', expectedRecipients: ['0x1111111111111111111111111111111111111111'], actualRecipient: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', amountAVAX: '0.1' }],
      inputTokens: 100, outputTokens: 20, errors: [], limitations: ['No live calls.'], chain: { chainId: 43113, forkBlockNumber: '59275449' } },
  });
}

test('full report includes stage results, precise risk evidence, task outcomes and measured usage', () => {
  const value = report();
  for (const formatted of [fullReportTerminal(value), fullReportMarkdown(value), fullReportHtml(value)]) {
    assert.match(formatted, /INSTALLATION HELD/); assert.match(formatted, /Regex/); assert.match(formatted, /LLM financial review/); assert.match(formatted, /Agent execution/);
    assert.match(formatted, /SKILL\\?\.md:6/); assert.match(formatted, /0xdeadbeef/); assert.match(formatted, /gpt\\?-6\\?-luna/);
    assert.match(formatted, /MOCKED TEST/); assert.match(formatted, /intended recipient reached/); assert.match(formatted, /NOT EXECUTED|Recipient.*provenance violations/);
    assert.match(formatted, /Swaps between trusted contacts/); assert.match(formatted, /not a safety certification/);
    assert.match(formatted, /Input tokens/); assert.match(formatted, /120/);
  }
  assert.match(fullReportTerminal(value), /Yes \/ Yes \| Yes \/ No \| 1 \/ 1/);
});

test('missing required stages remain unavailable and absent execution is not represented as benign', () => {
  const value = report(); value.analyses = value.analyses.slice(0, 1); value.behavioral = undefined; value.findings = []; value.decision = 'review';
  const text = fullReportTerminal(value);
  assert.match(text, /REVIEW REQUIRED/); assert.match(text, /LLM financial review \| UNAVAILABLE/); assert.match(text, /Agent execution \| UNAVAILABLE/);
  assert.match(text, /NOT EXECUTED/); assert.doesNotMatch(text, /With skill: BENIGN/); assert.match(text, /Missing measurements are not zero usage/);
});

test('HTML, Markdown and terminal reports keep hostile findings inert', () => {
  const value = report(); const hostile = '\u001b]8;;https://evil.invalid\u0007click\u001b]8;;\u0007<script>alert(1)</script>![image](https://evil.invalid/track)';
  value.findings[0]!.evidence[0]!.excerpt = hostile; value.name = hostile;
  const terminal = fullReportTerminal(value), markdown = fullReportMarkdown(value), html = fullReportHtml(value);
  assert.ok(!terminal.includes('\u001b')); assert.ok(!markdown.includes('\u001b')); assert.ok(!html.includes('\u001b'));
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img')); assert.ok(!html.includes('<a ')); assert.match(html, /&lt;script&gt;/);
  assert.match(html, /default-src 'none'/); assert.match(html, /<html lang="en">/);
  assert.ok(!markdown.includes('<script>')); assert.ok(!markdown.includes('![image]')); assert.match(markdown, /\\!\\\[image\\\]/);
});

test('completion, coverage and usage remain separate when an execution is incomplete', () => {
  const value = report(); value.behavioral!.verdict = 'ERROR'; value.behavioral!.complete = false; value.behavioral!.covered = false; value.behavioral!.errors.push('Provider timed out.'); value.decision = 'review';
  const text = fullReportTerminal(value);
  assert.match(text, /With skill: ERROR/); assert.match(text, /Execution INCOMPLETE/); assert.match(text, /Coverage NOT COVERED/); assert.match(text, /Provider timed out/);
  value.analyses[2]!.usage = { inputTokens: 100, outputTokens: 20, totalTokens: 120 };
  const withUsage = fullReportTerminal(value);
  assert.equal(withUsage.match(/100 \| 20 \| 120/g)?.length, 1);
});


test('preflight failures do not claim an API model or local fork actually ran', () => {
  const value = report(); value.behavioral!.kind = 'actual-openai-local-fuji-fork-audit';
  value.behavioral!.tasks = []; value.behavioral!.chain = undefined;
  value.behavioral!.verdict = 'ERROR'; value.behavioral!.complete = false; value.behavioral!.covered = false;
  value.behavioral!.errors = ['OPENAI_API_KEY is missing. No model request was made.'];
  const text = fullReportTerminal(value);
  assert.match(text, /Live provider configured — execution did not start/);
  assert.doesNotMatch(text, /Actual API model with a local Fuji fork/);
  assert.match(text, /OPENAI_API_KEY is missing/);
  value.behavioral!.kind = 'mocked-test';
  assert.match(fullReportTerminal(value), /MOCKED TEST/);
});
