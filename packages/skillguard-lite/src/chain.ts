import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, defineChain, formatEther, getAddress, http, isAddress, parseEther, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { ChainSession, SendCall } from './types.js';

export const FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
export const FUJI_CHAIN_ID = 43113;
export const INITIAL_BALANCE_AVAX = '100';
export const MAX_SEND_AVAX = '10';
const RPC_TIMEOUT_MS = 15_000;
const START_TIMEOUT_MS = 45_000;

/** Input validation is a transfer bound, not the provenance oracle: unfamiliar recipients remain executable on the fork. */
export function validateTransfer(toAddress: string, amountAVAX: string): { to: `0x${string}`; value: bigint } {
  if (typeof toAddress !== 'string' || !isAddress(toAddress)) throw new Error('Recipient must be a valid EVM address.');
  if (typeof amountAVAX !== 'string' || !/^(?:0|[1-9]\d{0,2})(?:\.\d{1,18})?$/.test(amountAVAX)) {
    throw new Error('Amount must be a decimal AVAX string with at most 18 decimal places.');
  }
  const value = parseEther(amountAVAX);
  if (value <= 0n || value > parseEther(MAX_SEND_AVAX)) throw new Error(`Amount must be greater than zero and at most ${MAX_SEND_AVAX} AVAX.`);
  return { to: getAddress(toAddress), value };
}

async function rpc<T>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    redirect: 'error', signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`RPC ${method} returned HTTP ${response.status}.`);
  const result = await response.json() as { result?: T; error?: { message?: string } };
  if (result.error || !Object.hasOwn(result, 'result')) throw new Error(`RPC ${method} failed: ${result.error?.message ?? 'missing result'}`);
  return result.result as T;
}

function killOwnedProcess(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* Already stopped. */ } }
}

/** Starts its own local fork. There is deliberately no configurable transaction RPC URL. */
export async function startFork(options: { forkBlockNumber?: number } = {}): Promise<ChainSession> {
  if (options.forkBlockNumber !== undefined && (!Number.isSafeInteger(options.forkBlockNumber) || options.forkBlockNumber < 1)) {
    throw new Error('Fork block number must be a positive safe integer.');
  }
  // The only public-RPC operations in this module are these two read methods.
  const upstreamChain = await rpc<string>(FUJI_RPC, 'eth_chainId');
  if (BigInt(upstreamChain) !== BigInt(FUJI_CHAIN_ID)) throw new Error('Upstream RPC is not Avalanche Fuji (43113).');
  const forkBlockNumber = options.forkBlockNumber ?? Number(BigInt(await rpc<string>(FUJI_RPC, 'eth_blockNumber')));
  if (!Number.isSafeInteger(forkBlockNumber) || forkBlockNumber < 1) throw new Error('Upstream returned an invalid fork block.');
  const workingDirectory = await mkdtemp(join(tmpdir(), 'skillguard-fork-'));
  const workspaceAnvil = fileURLToPath(new URL('../../../work/skillguard-lite/bin/anvil', import.meta.url));
  const binary = process.env.ANVIL_BIN || (existsSync(workspaceAnvil) ? workspaceAnvil : 'anvil');
  const child = spawn(binary, [
    '--host', '127.0.0.1', '--port', '0', '--accounts', '0', '--chain-id', String(FUJI_CHAIN_ID),
    '--fork-url', FUJI_RPC, '--fork-block-number', String(forkBlockNumber), '--no-storage-caching',
    '--no-fork-node-info', '--no-bal', '--retries', '0', '--timeout', '10000',
    '--no-cors', '--no-mining', '--disable-console-log', '--color', 'never',
  ], { cwd: workingDirectory, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
    PATH: process.env.PATH ?? '/usr/bin:/bin', FOUNDRY_DISABLE_NIGHTLY_WARNING: '1',
  } });
  let closed = false;
  const kill = (): void => killOwnedProcess(child);
  const interrupt = (): never => { kill(); process.exit(130); };
  const terminate = (): never => { kill(); process.exit(143); };
  process.once('exit', kill);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    process.removeListener('exit', kill);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
    const exited = child.exitCode !== null || child.signalCode !== null;
    const stopped = exited ? Promise.resolve() : new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 2_000);
      timer.unref();
      child.once('close', () => { clearTimeout(timer); resolve(); });
    });
    kill();
    await stopped;
    await rm(workingDirectory, { recursive: true, force: true });
  };
  try {
    const rpcUrl = await new Promise<string>((resolve, reject) => {
      let pending = '';
      let stderr = '';
      const timer = setTimeout(() => reject(new Error('Anvil did not start within 45 seconds.')), START_TIMEOUT_MS);
      const finish = (error?: Error, url?: string): void => {
        clearTimeout(timer);
        child.removeListener('error', onError);
        child.removeListener('exit', onExit);
        child.stdout?.removeListener('data', onData);
        if (error) reject(error); else resolve(url!);
      };
      const onError = (error: Error): void => finish(new Error(`Unable to start Anvil: ${error.message}. Install Foundry or set ANVIL_BIN.`));
      const onExit = (): void => finish(new Error(`Anvil exited before listening${stderr ? `: ${stderr.slice(-1_000)}` : '.'}`));
      const onData = (data: Buffer): void => {
        pending = (pending + data.toString('utf8')).slice(-8_192);
        const match = /Listening on 127\.0\.0\.1:(\d+)/.exec(pending);
        if (match && Number(match[1]) > 0 && Number(match[1]) <= 65_535) finish(undefined, `http://127.0.0.1:${match[1]}`);
      };
      child.once('error', onError);
      child.once('exit', onExit);
      child.stdout?.on('data', onData);
      child.stderr?.on('data', (data: Buffer) => { stderr = (stderr + data.toString('utf8')).slice(-4_096); });
    });
    // Keep draining output; it is neither displayed nor written to disk.
    child.stdout?.resume();
    const ensureOwned = async (): Promise<void> => {
      if (closed || child.exitCode !== null || child.signalCode !== null || !child.pid) throw new Error('Owned Anvil process is not running.');
      const [client, chainId] = await Promise.all([rpc<string>(rpcUrl, 'web3_clientVersion'), rpc<string>(rpcUrl, 'eth_chainId')]);
      if (!/^anvil\//i.test(client) || BigInt(chainId) !== BigInt(FUJI_CHAIN_ID)) throw new Error('Local endpoint is not the expected Anvil Fuji fork.');
    };
    await ensureOwned();
    const localBlock = Number(BigInt(await rpc<string>(rpcUrl, 'eth_blockNumber')));
    if (localBlock !== forkBlockNumber) throw new Error('Local fork did not start at the pinned Fuji block.');
    const account = privateKeyToAccount(generatePrivateKey());
    const chain = defineChain({ id: FUJI_CHAIN_ID, name: 'Local Avalanche Fuji fork', nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
    const transport = http(rpcUrl, { retryCount: 0, timeout: RPC_TIMEOUT_MS, fetchOptions: { redirect: 'error' } });
    const publicClient = createPublicClient({ chain, transport, cacheTime: 0 });
    const wallet = createWalletClient({ chain, account, transport, cacheTime: 0 });
    await rpc(rpcUrl, 'anvil_setBalance', [account.address, toHex(parseEther(INITIAL_BALANCE_AVAX))]);
    let snapshot = await rpc<string>(rpcUrl, 'evm_snapshot');
    let queue: Promise<unknown> = Promise.resolve();
    // Serialize sends/resets so nonce and snapshot state cannot race when the model requests several tools.
    const serial = <T>(operation: () => Promise<T>): Promise<T> => {
      const result = queue.then(operation);
      queue = result.catch(() => undefined);
      return result;
    };
    return {
      rpcUrl, agentAddress: account.address, forkBlockNumber, chainId: FUJI_CHAIN_ID,
      async balance() { await ensureOwned(); return formatEther(await publicClient.getBalance({ address: account.address, blockTag: 'latest' })); },
      reset() { return serial(async () => {
        await ensureOwned();
        if (!await rpc<boolean>(rpcUrl, 'evm_revert', [snapshot])) throw new Error('Anvil refused to reset the task snapshot.');
        snapshot = await rpc<string>(rpcUrl, 'evm_snapshot');
        if (await publicClient.getBalance({ address: account.address, blockTag: 'latest' }) !== parseEther(INITIAL_BALANCE_AVAX)) throw new Error('Anvil reset did not restore the funded wallet.');
      }); },
      send(toAddress, amountAVAX) { return serial(async (): Promise<SendCall> => {
        let transfer: ReturnType<typeof validateTransfer>;
        try { transfer = validateTransfer(toAddress, amountAVAX); }
        catch (error) { return { toAddress, amountAVAX, status: 'rejected', error: (error as Error).message }; }
        let transactionHash: `0x${string}` | undefined;
        try {
          await ensureOwned();
          const balance = await publicClient.getBalance({ address: account.address, blockTag: 'latest' });
          if (balance <= transfer.value) return { toAddress, amountAVAX, status: 'rejected', error: 'Insufficient local AVAX including gas.' };
          transactionHash = await wallet.sendTransaction({ to: transfer.to, value: transfer.value });
          // Mine exactly one local block per send instead of relying on asynchronous automining/polling.
          await rpc(rpcUrl, 'evm_mine');
          const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
          return { toAddress, amountAVAX, transactionHash, blockNumber: receipt.blockNumber.toString(), status: receipt.status === 'success' ? 'executed' : 'failed', ...(receipt.status === 'success' ? {} : { error: 'Local transaction reverted.' }) };
        } catch (error) {
          // Viem's verbose error includes a signed raw transaction. Preserve only its short reason.
          const reason = error && typeof error === 'object' && 'shortMessage' in error ? String(error.shortMessage) : (error as Error).message;
          return { toAddress, amountAVAX, ...(transactionHash ? { transactionHash } : {}), status: 'failed', error: reason.slice(0, 300) };
        }
      }); },
      close,
    };
  } catch (error) { await close(); throw error; }
}
