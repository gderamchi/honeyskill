import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runChainProof } from '../packages/security-lab/src/chain-proof.js';

test('actual owned local chain enforces policy before dispatch and proves exact native effects', {
  skip: process.env.SKILLGATE_LIVE_CHAIN_PROOF !== '1', timeout: 30000,
}, async () => {
  const proof = await runChainProof();
  assert.equal(proof.kind, 'actual-owned-local-anvil-policy-proof');
  assert.equal(proof.network.kind, 'ephemeral-local-genesis-no-public-fork');
  assert.equal(proof.network.chainId, 31337);
  assert.equal(proof.passed, true);
  assert.equal(proof.cases.length, 5);
  assert.equal(proof.cases.filter(item => item.actualAllowed).length, 1);
  assert.equal(proof.cases.reduce((sum, item) => sum + item.executorCalls, 0), 1);
  assert.equal(proof.transaction.valueWei, '1000000000000000');
  assert.equal(proof.transaction.to, '0x2222222222222222222222222222222222222222');
  assert.equal(proof.transaction.input, '0x');
  assert.equal(proof.receipt.status, 'success');
  assert.equal(proof.receipt.gasUsed, '21000');
  assert.equal(BigInt(proof.afterAuthorized.recipientBalanceWei) - BigInt(proof.before.recipientBalanceWei), 1000000000000000n);
  assert.equal(BigInt(proof.before.senderBalanceWei) - BigInt(proof.afterAuthorized.senderBalanceWei),
    1000000000000000n + BigInt(proof.receipt.gasUsed) * BigInt(proof.receipt.effectiveGasPriceWei));
  assert.deepEqual(proof.afterDenied, proof.before);
  assert.deepEqual(proof.afterReplay, proof.afterAuthorized);
  assert.equal(proof.afterAuthorized.senderNonce, proof.before.senderNonce + 1);
  assert.equal(proof.afterAuthorized.otherRecipientBalanceWei, proof.before.otherRecipientBalanceWei);
  const encoded = JSON.stringify(proof);
  assert.ok(!encoded.includes('privateKey') && !encoded.includes('127.0.0.1') && !encoded.includes('/Users/'));
});
