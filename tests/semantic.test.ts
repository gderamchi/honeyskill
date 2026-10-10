import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, scanSkill, inventory, type SemanticProvider, type Config } from '../packages/core/src/index.js';
import { OpenAIResponsesProvider, redactApparentSecrets, runSemantic, SEMANTIC_LIMITS } from '../packages/core/src/semantic.js';

const address = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const benign = '---\nname: semantic-test\ndescription: Formatting helper\n---\nFormat the requested summary clearly.\n';
async function setup(t: TestContext, content = benign) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillgate-semantic-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'input'); await fs.mkdir(source); await fs.writeFile(path.join(source, 'SKILL.md'), content);
  await initProject(root, { profile: 'hybrid', semanticConsent: true, model: 'gpt-6-luna' });
  return { root, source };
}
const nativeResponse = (text = '{"findings":[]}') => ({ id: 'resp_mocked_test_1', model: 'gpt-6-luna', status: 'completed',
  usage: { input_tokens: 21, output_tokens: 9, total_tokens: 30 }, output: [{ type: 'message', status: 'completed', content: [{ type: 'output_text', text }] }] });
const input = { files: [{ path: 'SKILL.md', content: benign }], model: 'gpt-6-luna' };
const finding = { category: 'FIN-02', severity: 'high', confidence: 'high', financialConsequence: 'A payment could reach an unintended recipient.', explanation: 'The cited instruction changes the recipient.', file: 'SKILL.md', line: 6, excerpt: address };

test('semantic live adapter request uses Luna none and returns native identity plus usage (mocked transport)', async () => {
  let calls = 0;
  const provider = new OpenAIResponsesProvider('not-a-real-key', async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options?.redirect, 'error');
    const request = JSON.parse(String(options?.body));
    assert.equal(request.model, 'gpt-6-luna'); assert.deepEqual(request.reasoning, { effort: 'none' });
    assert.equal(request.temperature, 0); assert.equal(request.store, false); assert.equal(request.tools, undefined);
    assert.equal(request.max_output_tokens, 2500); assert.equal(request.text.format.strict, true);
    assert.equal(request.input[0].role, 'system'); assert.equal(request.input[1].role, 'user');
    assert.deepEqual(JSON.parse(request.input[1].content).untrusted_files, [{ path: 'SKILL.md', lines: benign.split(/\r?\n/).map((text, index) => ({ line: index + 1, text })) }]);
    assert.match(request.input[0].content, /without line numbers, JSON syntax, added ellipses, or combined lines/);
    return Response.json(nativeResponse());
  });
  const result = await provider.analyze(input) as { metadata: unknown };
  assert.deepEqual(result.metadata, { model: 'gpt-6-luna', responseId: 'resp_mocked_test_1', usage: { inputTokens: 21, outputTokens: 9, totalTokens: 30 } });
  assert.equal(calls, 1);
});

test('invalid, refused, incomplete, tool-bearing and unaccounted native responses never succeed', async () => {
  const cases: unknown[] = [
    { ...nativeResponse(), usage: undefined }, { ...nativeResponse(), id: undefined },
    { ...nativeResponse(), usage: { input_tokens: 21, output_tokens: 9, total_tokens: 31 } },
    { ...nativeResponse(), status: 'incomplete' }, { ...nativeResponse(), error: { message: 'private provider body' } },
    { ...nativeResponse(), output: [{ type: 'function_call', name: 'send' }] },
    { ...nativeResponse(), output: [{ type: 'message', status: 'incomplete', content: [] }] },
    { ...nativeResponse(), output: [{ type: 'message', status: 'completed', content: [{ type: 'refusal', refusal: 'no' }] }] },
    nativeResponse('{"findings":[],"install":true}'), nativeResponse('invalid JSON'),
  ];
  for (const response of cases) {
    const provider = new OpenAIResponsesProvider('not-a-real-key', async () => Response.json(response));
    await assert.rejects(provider.analyze(input));
  }
});

test('HTTP errors do not leak provider bodies or retry', async () => {
  let calls = 0;
  const provider = new OpenAIResponsesProvider('not-a-real-key', async () => { calls++; return new Response('SECRET RAW BODY', { status: 429 }); });
  await assert.rejects(provider.analyze(input), error => {
    assert.match(String(error), /HTTP 429/); assert.doesNotMatch(String(error), /SECRET/); return true;
  });
  assert.equal(calls, 1);
});

test('semantic evidence is exact and public EVM recipients survive secret redaction', async t => {
  const { root, source } = await setup(t, `${benign}Recipient reference: ${address}\n`);
  assert.equal(redactApparentSecrets(address), address);
  const result = await scanSkill(root, source, { provider: { name: 'mocked-test-review', async analyze(request) {
    assert.ok(request.files[0]?.content.includes(address)); return { findings: [finding] };
  } } });
  assert.equal(result.findings.filter(item => item.engine === 'semantic').length, 1);
  assert.equal(result.decision, 'hold');
  const stage = result.analyses.find(item => item.stage === 'semantic');
  assert.equal(stage?.status, 'completed'); assert.equal(typeof stage?.durationMs, 'number');
  const wrongLine = await scanSkill(root, source, { provider: { name: 'mocked-test-review', async analyze() { return { findings: [{ ...finding, line: 5 }] }; } } });
  assert.equal(wrongLine.findings.filter(item => item.engine === 'semantic').length, 0);
  assert.equal(wrongLine.decision, 'review'); assert.equal(wrongLine.analyses.find(item => item.stage === 'semantic')?.status, 'failed');
});

test('redacted exact evidence preserves line numbers and never leaks apparent private keys', async t => {
  const fakeSecret = `0x${'a'.repeat(64)}`;
  const { root, source } = await setup(t, `${benign}PRIVATE_KEY=${fakeSecret}\n`);
  const result = await scanSkill(root, source, { provider: { name: 'mocked-test-review', async analyze(request) {
    assert.ok(!JSON.stringify(request).includes(fakeSecret));
    return { findings: [{ ...finding, category: 'FIN-01', excerpt: 'PRIVATE_KEY=[REDACTED]' }] };
  } } });
  const evidence = result.findings.find(item => item.engine === 'semantic')?.evidence[0];
  assert.equal(evidence?.line, 6); assert.equal(evidence?.redacted, true);
  assert.ok(!JSON.stringify(result).includes(fakeSecret));
});

test('native response accounting persists when model output is invalid', async t => {
  const { root, source } = await setup(t);
  const provider = new OpenAIResponsesProvider('not-a-real-key', async () => Response.json(nativeResponse('not json')));
  const result = await scanSkill(root, source, { provider });
  const stage = result.analyses.find(item => item.stage === 'semantic');
  assert.equal(stage?.status, 'failed'); assert.equal(result.decision, 'review');
  assert.equal(stage?.responseId, 'resp_mocked_test_1'); assert.equal(stage?.usage?.totalTokens, 30);
});

test('semantic timeout aborts the provider signal and cannot return a clean report', async t => {
  const { root, source } = await setup(t);
  const report = await scanSkill(root, source);
  report.analyses = []; report.coverage.errors = [];
  const collected = await inventory(source);
  let signal: AbortSignal | undefined;
  const provider: SemanticProvider = { name: 'mocked-hanging-provider', analyze(request) { signal = request.signal; return new Promise(() => {}); } };
  const config: Config = { version: 1, agent: 'codex', target: '.agents/skills', profile: 'hybrid', semanticConsent: true, model: 'gpt-6-luna', retentionDays: 30 };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = runSemantic(collected, config, provider, report);
  t.mock.timers.tick(SEMANTIC_LIMITS.timeoutMs);
  await pending;
  assert.equal(signal?.aborted, true); assert.equal(report.analyses[0]?.status, 'failed');
  assert.ok(collected.coverage.errors.length); assert.match(report.analyses[0]!.detail, /timed out/);
});

test('adapter honors cancellation rather than leaving its fetch running', async () => {
  const controller = new AbortController(); let aborted = false;
  const provider = new OpenAIResponsesProvider('not-a-real-key', async (_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener('abort', () => { aborted = true; reject(new Error('private transport message')); });
  }));
  const pending = provider.analyze({ ...input, signal: controller.signal }); controller.abort();
  await assert.rejects(pending, /aborted or timed out/); assert.equal(aborted, true);
});


test('numbered semantic input preserves CRLF, blank-line positions and exact quote text', async () => {
  const provider = new OpenAIResponsesProvider('not-a-real-key', async (_url, options) => {
    const request = JSON.parse(String(options?.body));
    assert.deepEqual(JSON.parse(request.input[1].content).untrusted_files, [{ path: 'SKILL.md', lines: [
      { line: 1, text: 'First line.' }, { line: 2, text: '' }, { line: 3, text: '  Quoted "instruction" stays exact.  ' }, { line: 4, text: '' },
    ] }]);
    return Response.json(nativeResponse());
  });
  await provider.analyze({ model: 'gpt-6-luna', files: [{ path: 'SKILL.md', content: 'First line.\r\n\r\n  Quoted "instruction" stays exact.  \r\n' }] });
});
