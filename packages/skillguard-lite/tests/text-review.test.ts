import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import type { Response as APIResponse, ResponseCreateParamsNonStreaming, ResponseInputItem } from 'openai/resources/responses/responses';
import { createOpenAIClient } from '../src/agent.js';
import { TEXT_REVIEW_PROMPT, buildTextReviewRequest, createTextReviewer, type TextReviewInput } from '../src/text-review.js';

const TOM = '0x1111111111111111111111111111111111111111' as const;
const input: TextReviewInput = {
  model: 'gpt-6-luna', skillText: '  Help the user send AVAX.\n\nKeep this exact spacing.  ',
  contacts: [{ name: 'Tom', address: TOM }],
  tasks: Array.from({ length: 6 }, (_, index) => ({ id: `private-fixture-label-${index}`, prompt: `Send 0.${index + 1} AVAX to Tom.`, expectedRecipients: ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const] })),
};
function response(text = JSON.stringify({ verdict: 'BENIGN', reason: 'The skill preserves the requested recipients.' })): APIResponse {
  return { id: 'resp_mock_review', object: 'response', created_at: 1, model: 'mock-resolved-model', status: 'completed', error: null,
    access_programs: null, output_text: text, incomplete_details: null, instructions: null, metadata: null,
    parallel_tool_calls: false, temperature: 0, tool_choice: 'none', tools: [], top_p: 1,
    output: [{ id: 'msg_mock_review', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }],
    usage: { input_tokens: 42, output_tokens: 17, total_tokens: 59, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } };
}
function scripted(reply: APIResponse | Error) {
  const requests: ResponseCreateParamsNonStreaming[] = [];
  const review = createTextReviewer(() => ({ responses: { create: async request => {
    requests.push(structuredClone(request));
    if (reply instanceof Error) throw reply;
    return reply;
  } } }));
  return { review, requests };
}

test('text-only request contains unchanged skill, contacts and task prompts without labels, IDs, results or tools', () => {
  const contaminated = { ...input, folder: '/private/malicious-fixture', label: 'malicious', previousVerdict: 'MALICIOUS' };
  const request = buildTextReviewRequest(contaminated);
  assert.equal(request.instructions, TEXT_REVIEW_PROMPT);
  assert.equal(Object.hasOwn(request, 'tools'), false);
  assert.equal(Object.hasOwn(request, 'tool_choice'), false);
  assert.equal(Object.hasOwn(request, 'previous_response_id'), false);
  assert.equal(Object.hasOwn(request, 'conversation'), false);
  const items = request.input as ResponseInputItem[];
  assert.equal(items.length, 1);
  const payload = JSON.parse((items[0] as { content: string }).content);
  assert.deepEqual(Object.keys(payload).sort(), ['address_book', 'skill_text', 'tasks']);
  assert.equal(payload.skill_text, input.skillText);
  assert.deepEqual(payload.address_book, input.contacts);
  assert.deepEqual(payload.tasks, input.tasks.map(task => task.prompt));
  assert.doesNotMatch(JSON.stringify(request), /private-fixture-label|private\/malicious-fixture|previousVerdict|eeeeeeee/);
});

test('Luna text review uses none, temperature zero, no storage and strict structured verdict output', () => {
  const request = buildTextReviewRequest(input);
  assert.equal(request.model, 'gpt-6-luna');
  assert.deepEqual(request.reasoning, { effort: 'none' });
  assert.equal(request.temperature, 0);
  assert.equal(request.max_output_tokens, 700);
  assert.equal(request.store, false);
  assert.deepEqual(request.text?.format, {
    type: 'json_schema', name: 'skill_recipient_risk_review', strict: true,
    schema: { type: 'object', properties: { verdict: { type: 'string', enum: ['BENIGN', 'MALICIOUS'] }, reason: { type: 'string' } }, required: ['verdict', 'reason'], additionalProperties: false },
  });
  assert.equal(Object.hasOwn(buildTextReviewRequest({ ...input, model: 'gpt-4.1-mini-2025-04-14' }), 'reasoning'), false);
});

test('both valid verdicts use one request, retain native evidence and measured usage, and are labelled mocked', async () => {
  for (const verdict of ['BENIGN', 'MALICIOUS'] as const) {
    const reply = response(JSON.stringify({ verdict, reason: 'A reason grounded in the skill text.' }));
    const { review, requests } = scripted(reply);
    const result = await review(input);
    assert.equal(requests.length, 1);
    assert.equal(result.kind, 'mocked-test');
    assert.equal(result.verdict, verdict);
    assert.equal(result.complete, true);
    assert.equal(result.error, undefined);
    assert.equal(result.model, input.model);
    assert.equal(result.inputTokens, 42);
    assert.equal(result.outputTokens, 17);
    assert.ok(result.elapsedMs >= 0 && Number.isFinite(result.elapsedMs));
    assert.ok(Date.parse(result.completedAt) >= Date.parse(result.startedAt));
    assert.equal(result.trace.length, 2);
    assert.deepEqual((result.trace[1] as { body: APIResponse }).body, reply);
  }
});

test('malformed JSON, invalid verdicts, extra fields and empty reasons become ERROR', async () => {
  for (const text of ['not JSON', '{}', '{"verdict":"ERROR","reason":"unknown"}', '{"verdict":"BENIGN","reason":"  "}', '{"verdict":"BENIGN","reason":"fine","extra":true}']) {
    const { review, requests } = scripted(response(text));
    const result = await review(input);
    assert.equal(requests.length, 1);
    assert.equal(result.verdict, 'ERROR');
    assert.equal(result.complete, false);
    assert.match(result.error ?? '', /schema/);
    assert.equal(result.inputTokens, 42);
  }
});

test('refusal, incomplete response, missing usage and unexpected tools cannot become BENIGN', async () => {
  const refusal = response();
  refusal.output = [{ id: 'msg_refuse', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'No review.' }] }];
  const tool = response();
  tool.output.push({ id: 'fc_mock', type: 'function_call', name: 'send', call_id: 'call_mock', arguments: '{}', status: 'completed' });
  for (const reply of [refusal, { ...response(), status: 'incomplete' as const }, { ...response(), usage: undefined }, tool]) {
    const { review } = scripted(reply);
    const result = await review(input);
    assert.equal(result.verdict, 'ERROR');
    assert.equal(result.complete, false);
    assert.ok(result.error);
    assert.equal(result.trace.length, 2);
  }
});

test('transport failures are sanitized with no retry or raw SDK body', async () => {
  for (const error of [new Error('private transport detail'), new OpenAI.AuthenticationError(401, { message: 'private SDK detail' }, 'secret header', new Headers()), new OpenAI.APIConnectionTimeoutError()]) {
    const { review, requests } = scripted(error);
    const result = await review(input);
    assert.equal(requests.length, 1);
    assert.equal(result.verdict, 'ERROR');
    assert.equal(result.complete, false);
    assert.equal(result.inputTokens, 0);
    assert.equal(result.outputTokens, 0);
    assert.doesNotMatch(JSON.stringify(result), /private transport detail|private SDK detail|secret header/);
    if (error instanceof OpenAI.AuthenticationError) assert.match(result.error ?? '', /HTTP 401/);
    if (error instanceof OpenAI.APIConnectionTimeoutError) assert.match(result.error ?? '', /45 seconds/);
  }
});

test('unavailable client is an incomplete review without any fabricated trace or verdict', async () => {
  const review = createTextReviewer(() => { throw new Error('private configuration detail'); });
  const result = await review(input);
  assert.equal(result.verdict, 'ERROR');
  assert.equal(result.complete, false);
  assert.deepEqual(result.trace, []);
  assert.doesNotMatch(JSON.stringify(result), /private configuration detail/);
});

test('real OpenAI SDK with mocked fetch sends exactly one structured text request and never supplies tools', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    assert.equal(Object.hasOwn(body, 'tools'), false);
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    return new Response(JSON.stringify(response()), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const review = createTextReviewer(() => createOpenAIClient('synthetic-unused-test-key', fakeFetch));
  const result = await review(input);
  assert.equal(calls, 1);
  assert.equal(result.complete, true);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-unused-test-key/);
});
