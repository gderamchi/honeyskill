import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { compileProgentPolicy, evaluateProgentCall, PROGENT_REFERENCE, type ProgentPolicy } from '../packages/security-policy/src/progent.js';

const toolSchema = { type: 'object', properties: { recipient: { type: 'string' }, amount: { type: 'integer' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['recipient', 'amount', 'tags'], additionalProperties: false };
const schemas = { send: toolSchema };
const good = { recipient: 'alice', amount: 10, tags: ['payment'] };
type Case = { id: string; policy: ProgentPolicy; tool: string; args: typeof good; expected: boolean };
const cases: Case[] = [
  { id: 'empty-policy-denies', policy: {}, tool: 'send', args: good, expected: false },
  { id: 'unknown-tool-denies', policy: { send: [[1, 0, {}, 0]] }, tool: 'shell', args: good, expected: false },
  { id: 'empty-rules-deny', policy: { send: [] }, tool: 'send', args: good, expected: false },
  { id: 'unconditional-allow', policy: { send: [[1, 0, {}, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'unconditional-forbid', policy: { send: [[1, 1, {}, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'enum-matches', policy: { send: [[1, 0, { recipient: { enum: ['alice'] } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'enum-mismatch', policy: { send: [[1, 0, { recipient: { enum: ['bob'] } }, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'lower-numeric-priority-wins', policy: { send: [[5, 1, {}, 0], [1, 0, {}, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'forbid-wins-priority-tie', policy: { send: [[1, 0, {}, 0], [1, 1, {}, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'failed-forbid-continues', policy: { send: [[1, 1, { recipient: { const: 'bob' } }, 0], [2, 0, {}, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'failed-allow-continues', policy: { send: [[1, 0, { recipient: { const: 'bob' } }, 0], [2, 0, {}, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'priority-100-failed-allow-denies', policy: { send: [[100, 0, { recipient: { const: 'bob' } }, 0], [101, 0, {}, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'priority-100-matching-allow', policy: { send: [[100, 0, { recipient: { const: 'alice' } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'conjunction-all-conditions-required', policy: { send: [[1, 0, { recipient: { const: 'alice' }, amount: { maximum: 9 } }, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'integer-boundary-included', policy: { send: [[1, 0, { amount: { type: 'integer', minimum: 10, maximum: 10 } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'exclusive-boundary-excluded', policy: { send: [[1, 0, { amount: { type: 'integer', exclusiveMaximum: 10 } }, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'not-blocked-member', policy: { send: [[1, 0, { recipient: { not: { enum: ['bob', 'eve'] } } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'anyof-match', policy: { send: [[1, 0, { recipient: { anyOf: [{ const: 'bob' }, { const: 'alice' }] } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'allof-match', policy: { send: [[1, 0, { amount: { allOf: [{ minimum: 5 }, { maximum: 15 }] } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'oneof-overlap-rejected', policy: { send: [[1, 0, { amount: { oneOf: [{ minimum: 5 }, { maximum: 15 }] } }, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'conditional-then', policy: { send: [[1, 0, { amount: { if: { minimum: 5 }, then: { maximum: 10 }, else: { maximum: 2 } } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'array-item-constraint', policy: { send: [[1, 0, { tags: { type: 'array', items: { enum: ['payment', 'memo'] }, minItems: 1, maxItems: 2 } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'array-item-mismatch', policy: { send: [[1, 0, { tags: { type: 'array', items: { enum: ['memo'] } } }, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'portable-regex-match', policy: { send: [[1, 0, { recipient: { type: 'string', pattern: '^alice$' } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'portable-regex-mismatch', policy: { send: [[1, 0, { recipient: { type: 'string', pattern: '^bob$' } }, 0]] }, tool: 'send', args: good, expected: false },
  { id: 'string-length', policy: { send: [[1, 0, { recipient: { type: 'string', minLength: 5, maxLength: 5 } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'multiple-of', policy: { send: [[1, 0, { amount: { type: 'integer', multipleOf: 5 } }, 0]] }, tool: 'send', args: good, expected: true },
  { id: 'schema-type-mismatch', policy: { send: [[1, 0, { amount: { type: 'string' } }, 0]] }, tool: 'send', args: good, expected: false },
];

for (const entry of cases) test(`Progent static core: ${entry.id}`, () => {
  assert.equal(evaluateProgentCall(compileProgentPolicy(entry.policy, schemas), entry.tool, entry.args).allowed, entry.expected);
});

test('strict boundary blocks absent args, extras and invalid types before Progent matching', () => {
  const compiled = compileProgentPolicy({ send: [[1, 0, { recipient: { const: 'alice' } }, 0]] }, schemas);
  for (const args of [{}, { ...good, amount: '10' }, { ...good, modelApproved: true }, [], null])
    assert.equal(evaluateProgentCall(compiled, 'send', args).reason, 'invalid-input');
  const optional = compileProgentPolicy({ send: [[1, 0, { recipient: { const: 'alice' } }, 0]] }, { send: { type: 'object' } });
  assert.equal(evaluateProgentCall(optional, 'send', {}).reason, 'missing-argument');
});

test('unsupported Progent features cannot silently widen the implemented subset', () => {
  for (const policy of [null, { send: [[1, 0, {}, 1]] }, { send: [[1, 0, {}, 2]] }, { send: [[1, 0, {}, 0, {}]] },
    { send: [[1, 0, { recipient: '^alice$' }, 0]] }, { send: [[1, 0, { recipient: { unknownKeyword: true } }, 0]] },
    { send: [[1, 0, { recipient: { $ref: 'https://example.invalid/schema' } }, 0]] },
    { send: [[1, 0, { recipient: { $async: true, type: 'string' } }, 0]] },
  ]) assert.throws(() => compileProgentPolicy(policy, schemas));
});

test('compiled policies are isolated from later caller mutation and cannot be forged', () => {
  const input: ProgentPolicy = { send: [[1, 0, { recipient: { const: 'alice' } }, 0]] };
  const compiled = compileProgentPolicy(input, schemas);
  input.send![0]![2].recipient = { const: 'bob' };
  assert.equal(evaluateProgentCall(compiled, 'send', good).allowed, true);
  assert.throws(() => evaluateProgentCall({} as never, 'send', good), /compileProgentPolicy/);
});

test('blockchain authorization actually invokes the Progent checker', async () => {
  const { compilePolicy, assessAction, createEmptyState } = await import('../packages/security-policy/src/index.js');
  const { exampleTrustedPolicyInput } = await import('../packages/security-policy/src/benchmark.js');
  const result = assessAction(compilePolicy(exampleTrustedPolicyInput()), {
    id: 'attack-1', capabilityId: 'pay-alice', type: 'send', chainId: 43113,
    sender: '0x1111111111111111111111111111111111111111', asset: 'native', recipient: '0x3333333333333333333333333333333333333333',
    amountUnits: '100', fees: { gasLimit: '21000', maxFeePerGasWei: '10', maxPriorityFeePerGasWei: '2' },
  }, createEmptyState(), 1000);
  assert.ok(result.violations.some(item => item.code === 'PROGENT_POLICY'));
});

// Execute only the five reviewed checker AST definitions from the exact pinned
// source. Importing all secagent would also initialize unrelated model/framework
// integrations, so no such module import is performed for this parity experiment.
const pythonHarness = String.raw`
import ast, hashlib, json, sys, re, inspect, importlib.metadata
from collections.abc import Callable
from jsonschema import validate
assert importlib.metadata.version('jsonschema') == '4.23.0'
source = open(sys.argv[1], encoding='utf-8').read()
assert hashlib.sha256(source.encode()).hexdigest() == sys.argv[2]
wanted = {'ValidationError', 'sort_policy', 'check_arg', '_check_tool_call', 'check_tool_call'}
nodes = [n for n in ast.parse(source).body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in wanted]
assert len(nodes) == len(wanted)
scope = {'validate': validate, 'Callable': Callable, 're': re, 'inspect': inspect, 'sys': sys, 'init_user_query': 'offline parity test'}
exec(compile(ast.Module(body=nodes, type_ignores=[]), '<pinned-progent-checker>', 'exec'), scope)
results = []
for case in json.load(sys.stdin):
    scope['security_policy'] = case['policy']
    scope['sort_policy']()
    try:
        scope['check_tool_call'](case['tool'], case['args'])
        allowed = True
    except Exception:
        allowed = False
    results.append({'id': case['id'], 'upstreamAllowed': allowed})
print(json.dumps(results))
`;

test('pinned upstream Python checker parity on 28 common-subset cases and documented strict-boundary divergence', t => {
  const sourcePath = process.env.SKILLGATE_PROGENT_REFERENCE ?? path.resolve('work/security-tools/progent-reference/secagent/tool.py');
  const python = process.env.SKILLGATE_PROGENT_PYTHON ?? path.resolve('work/security-tools/progent-venv/bin/python');
  if (!existsSync(sourcePath) || !existsSync(python)) { t.skip('Optional pinned upstream checkout/Python jsonschema environment is unavailable.'); return; }
  assert.equal(createHash('sha256').update(readFileSync(sourcePath)).digest('hex'), PROGENT_REFERENCE.sourceSha256);
  const require = createRequire(import.meta.url);
  assert.equal(JSON.parse(readFileSync(require.resolve('ajv/package.json'), 'utf8')).version, '8.20.0');
  const divergence = { id: 'missing-argument-boundary', policy: { send: [[1, 0, { recipient: { const: 'alice' } }, 0]] }, tool: 'send', args: {} };
  const result = spawnSync(python, ['-c', pythonHarness, sourcePath, PROGENT_REFERENCE.sourceSha256], {
    input: JSON.stringify([...cases, divergence]), encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
    env: { PATH: process.env.PATH, PYTHONIOENCODING: 'utf-8' },
  });
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout) as Array<{ id: string; upstreamAllowed: boolean }>;
  for (const entry of cases) {
    assert.equal(observed.find(item => item.id === entry.id)?.upstreamAllowed, entry.expected, entry.id);
    assert.equal(evaluateProgentCall(compileProgentPolicy(entry.policy, schemas), entry.tool, entry.args).allowed, entry.expected, entry.id);
  }
  assert.equal(observed.find(item => item.id === divergence.id)?.upstreamAllowed, true);
  assert.equal(evaluateProgentCall(compileProgentPolicy(divergence.policy, schemas), 'send', {}).allowed, false);
  if (process.env.SKILLGATE_PROGENT_EVIDENCE) writeFileSync(process.env.SKILLGATE_PROGENT_EVIDENCE, JSON.stringify({
    schemaVersion: 1, kind: 'pinned-upstream-static-checker-parity', reference: PROGENT_REFERENCE,
    validatorVersions: { pythonJsonschema: '4.23.0', ajv: '8.20.0' },
    cases: cases.map(entry => ({ ...entry, toolSchema, upstreamAllowed: observed.find(item => item.id === entry.id)!.upstreamAllowed,
      skillgateAllowed: evaluateProgentCall(compileProgentPolicy(entry.policy, schemas), entry.tool, entry.args).allowed })),
    strictBoundaryDivergence: { ...divergence, upstreamAllowed: true, skillgateAllowed: false, reason: 'Missing required argument rejected before policy matching.' },
    totals: { commonSubsetCases: cases.length, matchingVerdicts: cases.length, mismatches: 0, documentedHardeningDivergences: 1 },
    limitations: ['Static JSON Schema and fallback=0 subset only.', 'Not a reproduction of the paper agent benchmark or its attack success rate.', 'No provider, acquired skill or real tool was executed.'],
  }, null, 2) + '\n');
  t.diagnostic(`Reference ${PROGENT_REFERENCE.commit}: 28/28 common-subset verdicts match; 1 explicit missing-argument hardening divergence confirmed.`);
});
