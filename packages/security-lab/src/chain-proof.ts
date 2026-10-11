import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, defineChain, http, parseEther, toHex, type Address, type Hash } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { compilePolicy, createSecurityMediator, POLICY_VERSION, type ProposedAction } from '../../security-policy/src/index.js';
import { PROGENT_REFERENCE } from '../../security-policy/src/progent.js';
import { resolveAnvilExecutable } from '../../skillguard-lite/src/prerequisites.js';

const CHAIN_ID = 31337;
const RECIPIENT: Address = '0x2222222222222222222222222222222222222222';
const OTHER_RECIPIENT: Address = '0x3333333333333333333333333333333333333333';
const RPC_TIMEOUT_MS = 10000;

async function rpc<T>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), redirect: 'error', signal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Owned local RPC ${method} failed.`);
  const value = await response.json() as { result?: T; error?: unknown };
  if (value.error || !Object.hasOwn(value, 'result')) throw new Error(`Owned local RPC ${method} returned no result.`);
  return value.result as T;
}
function kill(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* Already stopped. */ } }
}

async function startOwnedAnvil() {
  const binary = await resolveAnvilExecutable();
  const directory = await mkdtemp(join(tmpdir(), 'skillgate-chain-proof-'));
  const child = spawn(binary.executable, ['--host', '127.0.0.1', '--port', '0', '--accounts', '0', '--chain-id', String(CHAIN_ID),
    '--no-mining', '--no-cors', '--disable-console-log', '--color', 'never'], {
    cwd: directory, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', FOUNDRY_DISABLE_NIGHTLY_WARNING: '1' },
  });
  let closed = false;
  const onExit = () => kill(child);
  const onInterrupt = () => { kill(child); process.exit(130); };
  const onTerminate = () => { kill(child); process.exit(143); };
  process.once('exit', onExit); process.once('SIGINT', onInterrupt); process.once('SIGTERM', onTerminate);
  const close = async () => {
    if (closed) return;
    closed = true;
    process.removeListener('exit', onExit); process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onTerminate);
    const stopped = child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 2000); timer.unref();
      child.once('close', () => { clearTimeout(timer); resolve(); });
    });
    kill(child); await stopped; await rm(directory, { recursive: true, force: true });
  };
  child.stderr?.resume(); // Never publish process output or signed request diagnostics.
  try {
    const url = await new Promise<string>((resolve, reject) => {
      let output = '', settled = false;
      const finish = (error?: string, port?: string) => {
        if (settled) return; settled = true; clearTimeout(timer);
        child.removeListener('error', failure); child.removeListener('exit', failure); child.stdout?.removeListener('data', onData);
        if (error) reject(new Error(error)); else resolve(`http://127.0.0.1:${port}`);
      };
      const failure = () => finish('Owned Anvil failed to start.');
      const onData = (chunk: Buffer) => {
        output = (output + chunk.toString('utf8')).slice(-8192);
        const match = /Listening on 127\.0\.0\.1:(\d+)/.exec(output);
        if (match && Number(match[1]) > 0 && Number(match[1]) <= 65535) finish(undefined, match[1]);
      };
      const timer = setTimeout(() => finish('Owned Anvil startup timed out.'), 10000);
      child.once('error', failure); child.once('exit', failure); child.stdout?.on('data', onData);
    });
    child.stdout?.resume();
    const ensureOwned = async () => {
      if (closed || child.exitCode !== null || child.signalCode !== null || !child.pid) throw new Error('Owned Anvil is not running.');
      const [client, id] = await Promise.all([rpc<string>(url, 'web3_clientVersion'), rpc<string>(url, 'eth_chainId')]);
      if (!/^anvil\//i.test(client) || BigInt(id) !== BigInt(CHAIN_ID)) throw new Error('Unexpected local chain identity.');
      return client;
    };
    const clientVersion = await ensureOwned();
    return { url, ensureOwned, close, anvilVersion: binary.version, clientVersion };
  } catch (error) { await close(); throw error; }
}

/** Actual owned local-genesis execution only; there is no configurable transaction RPC or private key input. */
export async function runChainProof() {
  const startedAt = new Date().toISOString();
  const session = await startOwnedAnvil();
  try {
    const account = privateKeyToAccount(generatePrivateKey());
    const chain = defineChain({ id: CHAIN_ID, name: 'SkillGate owned local proof', nativeCurrency: { name: 'Local test Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [session.url] } } });
    const transport = http(session.url, { timeout: RPC_TIMEOUT_MS, retryCount: 0, fetchOptions: { redirect: 'error' } });
    const publicClient = createPublicClient({ chain, transport, cacheTime: 0 });
    const wallet = createWalletClient({ account, chain, transport, cacheTime: 0 });
    await rpc(session.url, 'anvil_setBalance', [account.address, toHex(parseEther('1'))]);
    if (await publicClient.getBytecode({ address: RECIPIENT }) || await publicClient.getBytecode({ address: OTHER_RECIPIENT })) throw new Error('Proof recipients must be empty-code accounts.');
    const initialBlock = await publicClient.getBlock({ blockTag: 'latest' });
    if (initialBlock.baseFeePerGas === null || initialBlock.baseFeePerGas === undefined) throw new Error('Owned chain has no EIP-1559 base fee.');
    const amount = parseEther('0.001'), gas = 21000n, tip = 1000000000n;
    const maxFee = initialBlock.baseFeePerGas * 2n + tip;
    const fees = { gasLimit: gas.toString(), maxFeePerGasWei: maxFee.toString(), maxPriorityFeePerGasWei: tip.toString() };
    const policyInput = {
      version: POLICY_VERSION, id: 'owned-chain-proof', chainId: CHAIN_ID, wallet: account.address,
      expiresAtSeconds: Math.floor(Date.now() / 1000) + 600, maxCalls: 1, maxAttempts: 10, feeLimits: fees,
      maxTotalGasCostWei: (gas * maxFee).toString(), maxNativeCostWei: (amount + gas * maxFee).toString(),
      assetBudgets: [{ asset: 'native', maxUnits: amount.toString() }],
      capabilities: [{ id: 'exact-payment', type: 'send', maxUses: 1, asset: 'native', recipient: RECIPIENT, amountUnits: amount.toString() }],
    };
    const authorized = { id: 'authorized-payment', capabilityId: 'exact-payment', type: 'send', chainId: CHAIN_ID,
      sender: account.address, asset: 'native', recipient: RECIPIENT, amountUnits: amount.toString(), fees };
    let executorCalls = 0;
    let transactionHash: Hash | undefined;
    const observations = async () => {
      await session.ensureOwned();
      const [senderBalance, recipientBalance, otherBalance, nonce, blockNumber] = await Promise.all([
        publicClient.getBalance({ address: account.address, blockTag: 'latest' }), publicClient.getBalance({ address: RECIPIENT, blockTag: 'latest' }),
        publicClient.getBalance({ address: OTHER_RECIPIENT, blockTag: 'latest' }), publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }),
        publicClient.getBlockNumber({ cacheTime: 0 }),
      ]);
      return { senderBalanceWei: senderBalance.toString(), recipientBalanceWei: recipientBalance.toString(), otherRecipientBalanceWei: otherBalance.toString(), senderNonce: nonce, blockNumber: blockNumber.toString() };
    };
    const before = await observations();
    const monitor = createSecurityMediator(compilePolicy(policyInput), async (action: Readonly<ProposedAction>) => {
      executorCalls++;
      if (action.type !== 'send' || action.asset !== 'native' || action.chainId !== CHAIN_ID || action.sender !== account.address.toLowerCase()) throw new Error('Unsupported proof action.');
      await session.ensureOwned();
      // Every transaction field comes from the already-authorized immutable action.
      // No arbitrary calldata, signer, destination RPC, fee estimator or model text is used.
      transactionHash = await wallet.sendTransaction({ to: action.recipient as Address, value: BigInt(action.amountUnits), gas: BigInt(action.fees.gasLimit),
        maxFeePerGas: BigInt(action.fees.maxFeePerGasWei), maxPriorityFeePerGas: BigInt(action.fees.maxPriorityFeePerGasWei), data: '0x', type: 'eip1559' });
      await rpc(session.url, 'evm_mine');
      const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== 'success') throw new Error('Owned local transaction reverted.');
      return { status: 'executed', evidenceId: transactionHash };
    }, { nowSeconds: () => Math.floor(Date.now() / 1000) });
    const attempted = [];
    for (const [id, threat, action] of [
      ['wrong-recipient', 'recipient-substitution', { ...authorized, id: 'wrong-recipient', recipient: OTHER_RECIPIENT }],
      ['wrong-amount', 'amount-inflation', { ...authorized, id: 'wrong-amount', amountUnits: (amount + 1n).toString() }],
      ['high-fees', 'fee-inflation', { ...authorized, id: 'high-fees', fees: { ...fees, maxFeePerGasWei: (maxFee + 1n).toString() } }],
    ] as const) {
      const callsBefore = executorCalls, result = await monitor.mediate(action);
      attempted.push({ id, threat, expectedAllowed: false, action, actualAllowed: result.assessment.allowed, effect: result.record.effect,
        executorCalls: executorCalls - callsBefore, violations: result.assessment.violations, stateAfter: await observations() });
    }
    const afterDenied = await observations();
    const allowed = await monitor.mediate(authorized);
    attempted.push({ id: 'authorized-payment', threat: 'legitimate-exact-payment', expectedAllowed: true, action: authorized,
      actualAllowed: allowed.assessment.allowed, effect: allowed.record.effect, executorCalls,
      violations: allowed.assessment.violations, stateAfter: await observations() });
    if (allowed.record.effect !== 'executed' || !transactionHash) throw new Error('Authorized local proof transaction did not execute.');
    const afterAuthorized = await observations();
    const callsBeforeReplay = executorCalls, replay = await monitor.mediate(authorized);
    attempted.push({ id: 'replay', threat: 'duplicate-payment', expectedAllowed: false, action: authorized,
      actualAllowed: replay.assessment.allowed, effect: replay.record.effect, executorCalls: executorCalls - callsBeforeReplay,
      violations: replay.assessment.violations, stateAfter: await observations() });
    const afterReplay = await observations();
    const [receipt, transaction] = await Promise.all([publicClient.getTransactionReceipt({ hash: transactionHash }), publicClient.getTransaction({ hash: transactionHash })]);
    const actualFee = receipt.gasUsed * receipt.effectiveGasPrice;
    const assertions = {
      deniedCallsNeverDispatched: attempted.filter(item => !item.expectedAllowed).every(item => item.executorCalls === 0 && !item.actualAllowed && item.effect === 'blocked'),
      deniedCallsPreserveChainState: JSON.stringify(before) === JSON.stringify(afterDenied),
      exactlyOneExecutorCall: executorCalls === 1,
      exactRecipient: transaction.to?.toLowerCase() === RECIPIENT,
      exactSender: transaction.from.toLowerCase() === account.address.toLowerCase(),
      exactValue: transaction.value === amount,
      exactChain: transaction.chainId === CHAIN_ID,
      exactFeeFields: transaction.gas === gas && transaction.maxFeePerGas === maxFee && transaction.maxPriorityFeePerGas === tip,
      emptyCalldata: transaction.input === '0x',
      receiptSucceeded: receipt.status === 'success',
      recipientReceivedExactAmount: BigInt(afterAuthorized.recipientBalanceWei) - BigInt(before.recipientBalanceWei) === amount,
      unauthorizedRecipientUnchanged: afterAuthorized.otherRecipientBalanceWei === before.otherRecipientBalanceWei,
      senderPaidOnlyValueAndObservedFee: BigInt(before.senderBalanceWei) - BigInt(afterAuthorized.senderBalanceWei) === amount + actualFee,
      feeWithinReservedMaximum: actualFee <= gas * maxFee,
      exactlyOneMinedSenderTransaction: afterAuthorized.senderNonce === before.senderNonce + 1,
      replayPreservesChainState: JSON.stringify(afterAuthorized) === JSON.stringify(afterReplay),
    };
    return {
      schemaVersion: 1, kind: 'actual-owned-local-anvil-policy-proof' as const, startedAt, completedAt: new Date().toISOString(),
      policyVersion: POLICY_VERSION, referenceImplementation: PROGENT_REFERENCE,
      network: { kind: 'ephemeral-local-genesis-no-public-fork', chainId: CHAIN_ID, anvilVersion: session.anvilVersion,
        clientVersion: session.clientVersion, initialBlockHash: initialBlock.hash, initialBaseFeePerGasWei: initialBlock.baseFeePerGas.toString() },
      fixtureKind: 'synthetic-proposed-tool-actions', policy: policyInput, cases: attempted, before, afterDenied, afterAuthorized, afterReplay,
      transaction: { hash: transactionHash, chainId: transaction.chainId, from: transaction.from, to: transaction.to, valueWei: transaction.value.toString(),
        gasLimit: transaction.gas.toString(), maxFeePerGasWei: transaction.maxFeePerGas?.toString(), maxPriorityFeePerGasWei: transaction.maxPriorityFeePerGas?.toString(),
        input: transaction.input, nonce: transaction.nonce },
      receipt: { transactionHash: receipt.transactionHash, blockHash: receipt.blockHash, blockNumber: receipt.blockNumber.toString(), status: receipt.status,
        gasUsed: receipt.gasUsed.toString(), effectiveGasPriceWei: receipt.effectiveGasPrice.toString(), actualFeeWei: actualFee.toString() },
      assertions, passed: Object.values(assertions).every(Boolean),
      limitations: ['Synthetic action-policy integration proof, not real-malware or LLM detection accuracy.',
        'Only native transfers are executed. Approval, swap, HTTP and signing policy tests remain offline.',
        'This is an owned ephemeral local genesis chain, not mainnet or a public transaction. No external RPC is used.',
        'The fresh private key stays in memory and is never exported; no real wallet is used.',
        'A saved local receipt is checkable evidence of this run, not independent third-party attestation.'],
    };
  } catch {
    // Never publish viem diagnostics that can include signed transaction bodies.
    throw new Error('Owned local chain proof failed. No real wallet or public transaction endpoint was used.');
  } finally { await session.close(); }
}
