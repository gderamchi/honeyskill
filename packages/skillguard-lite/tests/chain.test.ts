import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEther } from 'viem';
import { startFork, validateTransfer, FUJI_CHAIN_ID } from '../src/chain.js';

const recipient = '0x1111111111111111111111111111111111111111';

test('transfer validation preserves exact decimal precision and does not enforce the address book', () => {
  assert.deepEqual(validateTransfer(recipient, '0.100000000000000001'), { to: recipient, value: 100000000000000001n });
  assert.equal(validateTransfer(recipient, '10').value, parseEther('10'));
});

test('transfer validation rejects malformed addresses and zero, negative, rounded or excessive amounts', () => {
  for (const address of ['Tom', '0x1234', 'https://example.com', recipient + '0']) {
    assert.throws(() => validateTransfer(address, '0.1'), /valid EVM address/);
  }
  for (const amount of ['0', '0.0', '-0.1', '1e-1', 'NaN', 'Infinity', '0.0000000000000000001', '.5', '01', '1.', ' 1', '10.000000000000000001', '999999999']) {
    assert.throws(() => validateTransfer(recipient, amount), /Amount/);
  }
  assert.throws(() => validateTransfer(recipient, 0.1 as unknown as string), /Amount/);
});

test('invalid fork pins fail before network or process access', async () => {
  for (const forkBlockNumber of [-1, 0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(startFork({ forkBlockNumber }), /positive safe integer/);
  }
});

test('actual Fuji fork executes local receipts, resets all state and closes its owned endpoint', {
  skip: process.env.SKILLGUARD_LIVE_CHAIN_TEST !== '1' ? 'Opt-in actual Fuji RPC test; no API model or public transactions.' : false,
  timeout: 120_000,
}, async () => {
  const session = await startFork();
  const localRpc = async <T>(method: string, params: unknown[] = []): Promise<T> => {
    const response = await fetch(session.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(5_000) });
    const body = await response.json() as { result: T; error?: unknown };
    assert.equal(body.error, undefined);
    return body.result;
  };
  try {
    assert.match(session.rpcUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(session.chainId, FUJI_CHAIN_ID);
    assert.equal(await session.balance(), '100');
    const before = BigInt(await localRpc<string>('eth_getBalance', [recipient, 'latest']));
    const rejected = await session.send(recipient, '0.0000000000000000001');
    assert.equal(rejected.status, 'rejected');
    const sent = await session.send(recipient, '0.1');
    assert.equal(sent.status, 'executed', sent.error ?? 'Expected a successful local transfer');
    assert.match(sent.transactionHash!, /^0x[0-9a-f]{64}$/);
    assert.equal(Number(sent.blockNumber), session.forkBlockNumber + 1);
    assert.equal(BigInt(await localRpc<string>('eth_getBalance', [recipient, 'latest'])) - before, parseEther('0.1'));
    assert.ok(Number(await session.balance()) < 99.9);
    await session.reset();
    assert.equal(await session.balance(), '100');
    assert.equal(BigInt(await localRpc<string>('eth_getBalance', [recipient, 'latest'])), before);
    assert.equal(Number(BigInt(await localRpc<string>('eth_getTransactionCount', [session.agentAddress, 'latest']))), 0);
    const parallel = await Promise.all([session.send(recipient, '0.1'), session.send(recipient, '0.2')]);
    assert.deepEqual(parallel.map(call => call.status), ['executed', 'executed']);
    assert.notEqual(parallel[0]!.transactionHash, parallel[1]!.transactionHash);
    await session.reset();
    await session.reset();
    assert.equal(await session.balance(), '100');
    await localRpc('anvil_setBalance', [session.agentAddress, '0x0']);
    assert.equal((await session.send(recipient, '0.1')).status, 'rejected');
  } finally { await session.close(); }
  await session.close();
  await assert.rejects(session.balance(), /not running/);
  assert.equal((await session.send(recipient, '0.1')).status, 'failed');
  await assert.rejects(localRpc('eth_chainId'));
});
