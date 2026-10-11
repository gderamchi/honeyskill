import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ActionSchema, POLICY_VERSION, UINT256_MAX, assessAction, compilePolicy, createEmptyState,
  createSecurityMediator, payloadSha256, type Capability, type ProposedAction,
} from '../packages/security-policy/src/index.js';
import { runPolicyBenchmark } from '../packages/security-policy/src/benchmark.js';

const wallet = '0x1111111111111111111111111111111111111111';
const alice = '0x2222222222222222222222222222222222222222';
const bob = '0x3333333333333333333333333333333333333333';
const tokenA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const tokenB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const router = '0x4444444444444444444444444444444444444444';
const fees = { gasLimit: '21000', maxFeePerGasWei: '10', maxPriorityFeePerGasWei: '2' };
const tx = { chainId: 43113, sender: wallet, fees };
const publicBody = '{"request":"public-quote"}';
const signingDigest = 'a'.repeat(64), domainSeparator = 'b'.repeat(64);
function policyInput() {
  return {
    version: POLICY_VERSION, id: 'trusted-task', chainId: 43113, wallet, expiresAtSeconds: 2000,
    maxCalls: 20, maxAttempts: 50, feeLimits: fees, maxTotalGasCostWei: '10000000', maxNativeCostWei: '10000000',
    assetBudgets: [{ asset: 'native', maxUnits: '1000' }, { asset: tokenA, maxUnits: '1000' }],
    capabilities: [
      { id: 'pay-alice', type: 'send', maxUses: 1, asset: 'native', recipient: alice, amountUnits: '100' },
      { id: 'approve-router', type: 'approve', maxUses: 1, asset: tokenA, spender: router, amountUnits: '100' },
      { id: 'swap-a-b', type: 'swap', maxUses: 1, router, assetIn: tokenA, assetOut: tokenB, amountInUnits: '100', minimumOutUnits: '190', quotedOutUnits: '200', recipient: alice, maxSlippageBps: 500, maxDeadlineSeconds: 1500 },
      { id: 'add-alice', type: 'whitelist', maxUses: 1, address: alice, operation: 'add' },
      { id: 'public-request', type: 'http_request', maxUses: 1, url: 'https://example.invalid/quote', method: 'POST', bodySha256: payloadSha256(publicBody) },
      { id: 'sign-exact', type: 'sign', maxUses: 1, format: 'eip712', digest: signingDigest, domainSeparator },
    ] satisfies Capability[],
  };
}
function policy(overrides: Record<string, unknown> = {}) { return compilePolicy({ ...policyInput(), ...overrides }); }
const send = (overrides: Record<string, unknown> = {}) => ({ id: 'send-1', capabilityId: 'pay-alice', type: 'send', ...tx, asset: 'native', recipient: alice, amountUnits: '100', ...overrides });
const approve = (overrides: Record<string, unknown> = {}) => ({ id: 'approve-1', capabilityId: 'approve-router', type: 'approve', ...tx, asset: tokenA, spender: router, amountUnits: '100', ...overrides });
const swap = (overrides: Record<string, unknown> = {}) => ({ id: 'swap-1', capabilityId: 'swap-a-b', type: 'swap', ...tx, router, assetIn: tokenA, assetOut: tokenB, amountInUnits: '100', minimumOutUnits: '190', recipient: alice, slippageBps: 500, deadlineSeconds: 1500, ...overrides });
const http = (overrides: Record<string, unknown> = {}) => ({ id: 'http-1', capabilityId: 'public-request', type: 'http_request', url: 'https://example.invalid/quote', method: 'POST', body: publicBody, ...overrides });
const sign = (overrides: Record<string, unknown> = {}) => ({ id: 'sign-1', capabilityId: 'sign-exact', type: 'sign', chainId: 43113, signer: wallet, format: 'eip712', digest: signingDigest, domainSeparator, ...overrides });
function check(candidate: unknown, overrides: Record<string, unknown> = {}) { return assessAction(policy(overrides), candidate, createEmptyState(), 1000); }
function denied(candidate: unknown, code: string, overrides: Record<string, unknown> = {}) {
  const result = check(candidate, overrides);
  assert.equal(result.allowed, false);
  assert.ok(result.violations.some(item => item.code === code), JSON.stringify(result.violations));
}

test('all six explicitly authorized action families pass exact trusted capabilities', () => {
  for (const candidate of [send(), approve(), swap(), http(), sign(), { id: 'whitelist-1', capabilityId: 'add-alice', type: 'whitelist', chainId: 43113, address: alice, operation: 'add' }])
    assert.deepEqual(check(candidate).violations, []);
});

for (const [name, candidate, code] of [
  ['a different address-book contact is not authorized', send({ recipient: bob }), 'AUTHORIZATION_MISMATCH'],
  ['wrong asset', send({ asset: tokenA }), 'AUTHORIZATION_MISMATCH'],
  ['one wei above exact amount', send({ amountUnits: '101' }), 'AUTHORIZATION_MISMATCH'],
  ['one wei below exact amount', send({ amountUnits: '99' }), 'AUTHORIZATION_MISMATCH'],
  ['wrong chain', send({ chainId: 1 }), 'CHAIN_MISMATCH'],
  ['wrong sending wallet', send({ sender: bob }), 'SENDER_MISMATCH'],
  ['unknown capability', send({ capabilityId: 'model-proposed-authority' }), 'CAPABILITY_MISSING'],
  ['wrong capability type', send({ capabilityId: 'approve-router' }), 'CAPABILITY_MISSING'],
  ['gas limit inflation', send({ fees: { ...fees, gasLimit: '21001' } }), 'FEE_LIMIT'],
  ['max fee inflation', send({ fees: { ...fees, maxFeePerGasWei: '11' } }), 'FEE_LIMIT'],
  ['priority fee inflation', send({ fees: { ...fees, maxPriorityFeePerGasWei: '3' } }), 'FEE_LIMIT'],
  ['priority fee above fee cap', send({ fees: { ...fees, maxFeePerGasWei: '1' } }), 'INVALID_FEES'],
  ['unlimited approval', approve({ amountUnits: UINT256_MAX }), 'UNLIMITED_APPROVAL'],
  ['approval to different spender', approve({ spender: bob }), 'AUTHORIZATION_MISMATCH'],
  ['approval for different token', approve({ asset: tokenB }), 'AUTHORIZATION_MISMATCH'],
  ['increased approval', approve({ amountUnits: '101' }), 'AUTHORIZATION_MISMATCH'],
  ['unwanted swap output token', swap({ assetOut: 'native' }), 'AUTHORIZATION_MISMATCH'],
  ['unwanted swap input token', swap({ assetIn: 'native' }), 'AUTHORIZATION_MISMATCH'],
  ['malicious swap router', swap({ router: bob }), 'AUTHORIZATION_MISMATCH'],
  ['redirected swap proceeds', swap({ recipient: bob }), 'AUTHORIZATION_MISMATCH'],
  ['increased swap input', swap({ amountInUnits: '101' }), 'AUTHORIZATION_MISMATCH'],
  ['high slippage', swap({ slippageBps: 501 }), 'SLIPPAGE_LIMIT'],
  ['low minimum output', swap({ minimumOutUnits: '189' }), 'MINIMUM_OUTPUT'],
  ['false zero-slippage declaration', swap({ minimumOutUnits: '190', slippageBps: 0 }), 'MINIMUM_OUTPUT'],
  ['expired swap', swap({ deadlineSeconds: 1000 }), 'SWAP_DEADLINE'],
  ['extended swap deadline', swap({ deadlineSeconds: 1501 }), 'SWAP_DEADLINE'],
  ['private key extraction', { id: 'secret-1', capabilityId: 'pay-alice', type: 'read_secret', secretType: 'private_key' }, 'SECRET_ACCESS'],
  ['seed phrase extraction', { id: 'secret-2', capabilityId: 'pay-alice', type: 'read_secret', secretType: 'seed_phrase' }, 'SECRET_ACCESS'],
  ['credential extraction', { id: 'secret-3', capabilityId: 'pay-alice', type: 'read_secret', secretType: 'credential' }, 'SECRET_ACCESS'],
  ['secret-like payload exfiltration', http({ body: 'FAKE_PRIVATE_KEY_TEST_ONLY' }), 'EGRESS_PAYLOAD'],
  ['exfiltration URL substitution', http({ url: 'https://attacker.invalid/collect' }), 'AUTHORIZATION_MISMATCH'],
  ['exfiltration in query', http({ url: 'https://example.invalid/quote?seed=FAKE_TEST_ONLY' }), 'AUTHORIZATION_MISMATCH'],
  ['forced whitelist addition', { id: 'whitelist-1', capabilityId: 'add-alice', type: 'whitelist', chainId: 43113, address: bob, operation: 'add' }, 'AUTHORIZATION_MISMATCH'],
  ['forced whitelist removal', { id: 'whitelist-1', capabilityId: 'add-alice', type: 'whitelist', chainId: 43113, address: alice, operation: 'remove' }, 'AUTHORIZATION_MISMATCH'],
  ['arbitrary digest signing', sign({ digest: 'c'.repeat(64) }), 'AUTHORIZATION_MISMATCH'],
  ['signing domain substitution', sign({ domainSeparator: 'c'.repeat(64) }), 'AUTHORIZATION_MISMATCH'],
  ['wrong signing wallet', sign({ signer: bob }), 'SIGNER_MISMATCH'],
] as const) test(`policy denies ${name}`, () => denied(candidate, code));

test('invalid and unknown actions fail closed without parsing exceptions', () => {
  for (const candidate of [null, [], {}, { type: 'shell', command: 'unexecuted test' }, send({ approvedByModel: true }),
    send({ policy: policyInput() }), http({ containsSecrets: false }), send({ capabilityId: '__proto__' }),
    ...['-1', '1.1', '1e2', '001', '100\n', '0x64', '', 'not-a-number', (2n ** 256n).toString(), 100, NaN, Infinity, null].map(amountUnits => send({ amountUnits })),
    http({ url: 'bad url' }), http({ url: 'http://example.invalid' }), http({ url: 'https://user:pass@example.invalid' }),
    http({ url: 'https://example.invalid/#secret' }), sign({ format: 'personal_sign' }), send({ data: '0x1234' }),
  ]) denied(candidate, 'MALFORMED_ACTION');
});

test('trusted policy is separately validated, cloned, frozen and cannot be forged as a structural object', () => {
  const input = policyInput(), compiled = compilePolicy(input);
  input.capabilities[0] = { id: 'pay-bob', type: 'send', maxUses: 1, asset: 'native', recipient: bob, amountUnits: '999' };
  assert.equal(assessAction(compiled, send(), createEmptyState(), 1000).allowed, true);
  assert.throws(() => { (compiled.capabilities[0] as { recipient: string }).recipient = bob; });
  assert.throws(() => assessAction(policyInput() as never, send(), createEmptyState(), 1000), /compilePolicy/);
  assert.throws(() => compilePolicy({ ...policyInput(), capabilities: [...policyInput().capabilities, policyInput().capabilities[0]] }));
  assert.throws(() => compilePolicy({ ...policyInput(), capabilities: [{ id: 'unlimited', type: 'approve', maxUses: 1, asset: tokenA, spender: router, amountUnits: UINT256_MAX }] }));
});

test('uint256 boundaries use exact integers and never float rounding', () => {
  const amount = UINT256_MAX;
  const p = policy({ capabilities: [{ id: 'pay-alice', type: 'send', maxUses: 1, asset: tokenA, recipient: alice, amountUnits: amount }], assetBudgets: [{ asset: tokenA, maxUnits: amount }] });
  assert.equal(assessAction(p, send({ asset: tokenA, amountUnits: amount }), createEmptyState(), 1000).allowed, true);
  assert.equal(assessAction(p, send({ asset: tokenA, amountUnits: (BigInt(amount) - 1n).toString() }), createEmptyState(), 1000).allowed, false);
});

test('swap integer rounding enforces the stronger quote-derived minimum', () => {
  const capabilities = policyInput().capabilities.map(item => item.type === 'swap' ? { ...item, quotedOutUnits: '201' } : item);
  denied(swap({ minimumOutUnits: '190' }), 'MINIMUM_OUTPUT', { capabilities });
  assert.equal(check(swap({ minimumOutUnits: '191' }), { capabilities }).allowed, true);
});

test('expiry, exact gas upper bound and value plus gas are independently enforced', () => {
  denied(send(), 'POLICY_EXPIRED', { expiresAtSeconds: 1000 });
  assert.equal(assessAction(policy(), send(), createEmptyState(), NaN).allowed, false);
  denied(send(), 'GAS_BUDGET', { maxTotalGasCostWei: '209999' });
  denied(send(), 'NATIVE_BUDGET', { maxNativeCostWei: '210099' });
  assert.equal(check(send(), { maxTotalGasCostWei: '210000', maxNativeCostWei: '210100' }).allowed, true);
  denied(send(), 'ASSET_BUDGET', { assetBudgets: [] });
  denied(approve(), 'ASSET_BUDGET', { assetBudgets: [{ asset: tokenA, maxUnits: '99' }] });
});

test('pre-effect mediation blocks every denied candidate without calling executor', async () => {
  let called = 0;
  const monitor = createSecurityMediator(policy(), async () => { called++; return { status: 'executed' }; }, { nowSeconds: () => 1000 });
  for (const candidate of [send({ recipient: bob }), approve({ amountUnits: UINT256_MAX }), swap({ recipient: bob }), http({ body: 'FAKE_SECRET_ONLY' }), { type: 'shell' }]) {
    const result = await monitor.mediate(candidate);
    assert.equal(result.record.effect, 'blocked');
    assert.equal(result.assessment.allowed, false);
  }
  assert.equal(called, 0);
  assert.equal(monitor.snapshot().state.reservedCalls, 0);
  assert.equal(JSON.stringify(monitor.snapshot()).includes('FAKE_SECRET_ONLY'), false);
});

test('duplicate action IDs and exhausted capabilities prevent duplicate payments', async () => {
  let called = 0;
  const monitor = createSecurityMediator(policy(), async () => { called++; return { status: 'executed', evidenceId: 'simulation-1' }; }, { nowSeconds: () => 1000 });
  assert.equal((await monitor.mediate(send())).record.effect, 'executed');
  assert.ok((await monitor.mediate(send())).assessment.violations.some(item => item.code === 'REPLAY'));
  assert.ok((await monitor.mediate(send({ id: 'send-2' }))).assessment.violations.some(item => item.code === 'CAPABILITY_EXHAUSTED'));
  assert.equal(called, 1);
});

test('parallel calls reserve before awaiting effects; pending effects cannot race the budget', async () => {
  let release!: () => void, called = 0;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const monitor = createSecurityMediator(policy(), async () => { called++; await wait; return { status: 'executed' }; }, { nowSeconds: () => 1000 });
  const first = monitor.mediate(send());
  assert.equal(monitor.snapshot().records[0]?.effect, 'pending');
  const second = await monitor.mediate(send({ id: 'send-2' }));
  assert.equal(second.record.effect, 'blocked');
  assert.equal(called, 1);
  release();
  assert.equal((await first).record.effect, 'executed');
});

test('budget is retained after ambiguous errors; evidence never retains exception bodies', async () => {
  const monitor = createSecurityMediator(policy(), async () => { throw new Error('FAKE_SECRET_IN_EXCEPTION'); }, { nowSeconds: () => 1000 });
  assert.equal((await monitor.mediate(send())).record.effect, 'unknown');
  assert.equal((await monitor.mediate(send({ id: 'send-2' }))).record.effect, 'blocked');
  assert.equal(monitor.snapshot().state.totalNativeCostWei, '210100');
  assert.equal(JSON.stringify(monitor.snapshot()).includes('FAKE_SECRET_IN_EXCEPTION'), false);
});

test('cumulative asset, gas, native and call budgets block separately', async () => {
  for (const [overrides, code] of [
    [{ assetBudgets: [{ asset: 'native', maxUnits: '199' }] }, 'ASSET_BUDGET'],
    [{ maxTotalGasCostWei: '419999' }, 'GAS_BUDGET'],
    [{ maxNativeCostWei: '420199' }, 'NATIVE_BUDGET'],
    [{ maxCalls: 1 }, 'CALL_LIMIT'],
  ] as const) {
    const capabilities = [{ id: 'pay-alice', type: 'send', maxUses: 2, asset: 'native', recipient: alice, amountUnits: '100' }];
    const monitor = createSecurityMediator(policy({ ...overrides, capabilities }), async () => ({ status: 'executed' }), { nowSeconds: () => 1000 });
    assert.equal((await monitor.mediate(send())).record.effect, 'executed');
    assert.ok((await monitor.mediate(send({ id: 'send-2' }))).assessment.violations.some(item => item.code === code));
  }
});

test('attempt logs are bounded and exhausting attempts never invokes effects', async () => {
  let called = 0;
  const monitor = createSecurityMediator(policy({ maxCalls: 1, maxAttempts: 2 }), async () => { called++; return { status: 'executed' }; }, { nowSeconds: () => 1000 });
  await monitor.mediate({ type: 'shell' }); await monitor.mediate({ type: 'shell' });
  assert.ok((await monitor.mediate(send())).assessment.violations.some(item => item.code === 'ATTEMPT_LIMIT'));
  assert.equal(called, 0);
  assert.equal(monitor.snapshot().records.length, 2);
});

test('executor receives a frozen clone; input and evidence mutations cannot change authority', async () => {
  let received!: Readonly<ProposedAction>;
  const monitor = createSecurityMediator(policy(), async action => { received = action; assert.ok(Object.isFrozen(action)); return { status: 'executed' }; }, { nowSeconds: () => 1000 });
  const candidate = send(); const pending = monitor.mediate(candidate); candidate.recipient = bob;
  assert.equal((await pending).record.effect, 'executed');
  assert.equal(received.type === 'send' && received.recipient, alice);
  const snapshot = monitor.snapshot(); snapshot.state.capabilityUses['pay-alice'] = 0;
  assert.equal((await monitor.mediate(send({ id: 'send-2' }))).record.effect, 'blocked');
});

test('metamorphic address and amount variants are checked against independently constructed task contracts', () => {
  // Deterministic synthetic oracle regression; these are not independent malware samples.
  for (let i = 1n; i <= 128n; i++) {
    const recipient = `0x${(1000n + i).toString(16).padStart(40, '0')}`;
    const amountUnits = (2n ** 64n + i).toString();
    const p = policy({ capabilities: [{ id: 'pay-alice', type: 'send', maxUses: 1, asset: tokenA, recipient, amountUnits }], assetBudgets: [{ asset: tokenA, maxUnits: amountUnits }] });
    const candidate = send({ asset: tokenA, recipient, amountUnits });
    assert.equal(assessAction(p, candidate, createEmptyState(), 1000).allowed, true);
    assert.equal(assessAction(p, { ...candidate, recipient: bob }, createEmptyState(), 1000).allowed, false);
    assert.equal(assessAction(p, { ...candidate, amountUnits: (BigInt(amountUnits) + 1n).toString() }, createEmptyState(), 1000).allowed, false);
  }
});

test('address case normalization preserves the same authorized EVM address', () => {
  assert.equal(check(send({ asset: tokenA.toUpperCase().replace('0X', '0x') }), { capabilities: [{ id: 'pay-alice', type: 'send', maxUses: 1, asset: tokenA, recipient: alice, amountUnits: '100' }] }).allowed, true);
  assert.equal(ActionSchema.safeParse(send({ recipient: `${alice}\n` })).success, false);
});

test('offline benchmark is seed-reproducible and each exported contract independently replays', async () => {
  const benchmark = await runPolicyBenchmark();
  assert.equal(benchmark.kind, 'deterministic-tool-mediation-regression');
  assert.equal(benchmark.totals.failed, 0);
  assert.equal(benchmark.totals.cases, 42);
  assert.deepEqual(await runPolicyBenchmark(), benchmark);
  for (const entry of benchmark.cases) {
    const replay = assessAction(compilePolicy(entry.policy), entry.action, createEmptyState(), benchmark.trustedNowSeconds);
    assert.equal(replay.allowed, entry.expectedAllowed, entry.id);
    assert.deepEqual(replay.violations, entry.violations, entry.id);
  }
  const changed = await runPolicyBenchmark(1);
  assert.notDeepEqual(changed.cases.find(item => item.generated)?.action, benchmark.cases.find(item => item.generated)?.action);
  await assert.rejects(runPolicyBenchmark(0));
});
