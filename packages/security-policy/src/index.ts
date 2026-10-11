import { createHash } from 'node:crypto';
import { z } from 'zod';
import { compileProgentPolicy, evaluateProgentCall, type CompiledProgentPolicy, type ProgentPolicy } from './progent.js';

/** A bounded tool reference monitor, not a transaction simulator or a malware classifier. */
export const POLICY_VERSION = 'skillgate-capabilities-v1';
export const UINT256_MAX = (2n ** 256n - 1n).toString();
const uint = z.string().max(78).regex(/^(0|[1-9][0-9]*)$(?![\s\S])/)
  .pipe(z.string().refine(value => BigInt(value) <= BigInt(UINT256_MAX), 'uint256 overflow'));
const positiveUint = uint.pipe(z.string().refine(value => BigInt(value) > 0n, 'Expected positive integer'));
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$(?![\s\S])/).transform(value => value.toLowerCase());
const asset = z.union([z.literal('native'), address]);
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$(?![\s\S])/).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value));
const digest = z.string().regex(/^[a-f0-9]{64}$(?![\s\S])/);
const seconds = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const chainId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const httpsUrl = z.string().max(2048).url().refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash; }
  catch { return false; }
}, 'Expected HTTPS URL without credentials or fragment');
export const FeesSchema = z.object({ gasLimit: positiveUint, maxFeePerGasWei: uint, maxPriorityFeePerGasWei: uint }).strict();
const common = { id: identifier, capabilityId: identifier };
const tx = { ...common, chainId, sender: address, fees: FeesSchema };

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ ...tx, type: z.literal('send'), asset, recipient: address, amountUnits: positiveUint }).strict(),
  z.object({ ...tx, type: z.literal('approve'), asset: address, spender: address, amountUnits: uint }).strict(),
  z.object({ ...tx, type: z.literal('swap'), router: address, assetIn: asset, assetOut: asset, amountInUnits: positiveUint,
    minimumOutUnits: positiveUint, recipient: address, slippageBps: z.number().int().min(0).max(10000), deadlineSeconds: seconds }).strict(),
  z.object({ ...common, type: z.literal('whitelist'), chainId, address, operation: z.enum(['add', 'remove']) }).strict(),
  z.object({ ...common, type: z.literal('read_secret'), secretType: z.enum(['private_key', 'seed_phrase', 'credential']) }).strict(),
  z.object({ ...common, type: z.literal('http_request'), url: httpsUrl, method: z.enum(['GET', 'POST']), body: z.string().max(16384) }).strict(),
  z.object({ ...common, type: z.literal('sign'), chainId, signer: address, format: z.literal('eip712'), digest, domainSeparator: digest }).strict(),
]);
export type ProposedAction = z.infer<typeof ActionSchema>;
const grant = { id: identifier, maxUses: z.number().int().min(1).max(1000) };
export const CapabilitySchema = z.discriminatedUnion('type', [
  z.object({ ...grant, type: z.literal('send'), asset, recipient: address, amountUnits: positiveUint }).strict(),
  z.object({ ...grant, type: z.literal('approve'), asset: address, spender: address, amountUnits: uint }).strict(),
  z.object({ ...grant, type: z.literal('swap'), router: address, assetIn: asset, assetOut: asset, amountInUnits: positiveUint,
    minimumOutUnits: positiveUint, quotedOutUnits: positiveUint, recipient: address,
    maxSlippageBps: z.number().int().min(0).max(9999), maxDeadlineSeconds: seconds }).strict(),
  z.object({ ...grant, type: z.literal('whitelist'), address, operation: z.enum(['add', 'remove']) }).strict(),
  z.object({ ...grant, type: z.literal('http_request'), url: httpsUrl, method: z.enum(['GET', 'POST']), bodySha256: digest }).strict(),
  z.object({ ...grant, type: z.literal('sign'), format: z.literal('eip712'), digest, domainSeparator: digest }).strict(),
]);
export type Capability = z.infer<typeof CapabilitySchema>;
export const PolicySchema = z.object({
  version: z.literal(POLICY_VERSION), id: identifier, chainId, wallet: address, expiresAtSeconds: seconds,
  maxCalls: z.number().int().min(1).max(1000), maxAttempts: z.number().int().min(1).max(10000),
  feeLimits: FeesSchema, maxTotalGasCostWei: uint, maxNativeCostWei: uint,
  assetBudgets: z.array(z.object({ asset, maxUnits: uint }).strict()).max(100),
  capabilities: z.array(CapabilitySchema).max(100),
}).strict().superRefine((policy, ctx) => {
  for (const [name, values] of [
    ['capabilities', policy.capabilities.map(item => item.id)], ['assetBudgets', policy.assetBudgets.map(item => item.asset)],
  ] as const) if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: `Duplicate ${name}` });
  if (policy.maxAttempts < policy.maxCalls) ctx.addIssue({ code: 'custom', message: 'maxAttempts must cover maxCalls' });
  for (const capability of policy.capabilities) {
    if (capability.type === 'approve' && capability.amountUnits === UINT256_MAX)
      ctx.addIssue({ code: 'custom', message: 'Unlimited approvals are never supported' });
    if (capability.type === 'swap' && capability.assetIn === capability.assetOut)
      ctx.addIssue({ code: 'custom', message: 'Swap assets must differ' });
  }
});

declare const trustedPolicy: unique symbol;
export type TrustedPolicy = Readonly<z.infer<typeof PolicySchema>> & { readonly [trustedPolicy]: true };
const compiled = new WeakSet<object>();
const progentPolicies = new WeakMap<object, CompiledProgentPolicy>();
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** Trusted-host entry point only. Never compile skill text, model output or a tool argument as policy. */
export function compilePolicy(input: unknown): TrustedPolicy {
  const result = freeze(PolicySchema.parse(input)) as TrustedPolicy;
  const rules: ProgentPolicy = { read_secret: [[0, 1, {}, 0]] };
  const exactFields = new Set(['asset', 'recipient', 'amountUnits', 'spender', 'router', 'assetIn', 'assetOut', 'amountInUnits',
    'address', 'operation', 'url', 'method', 'bodySha256', 'format', 'digest', 'domainSeparator']);
  for (const capability of result.capabilities) {
    const conditions: Record<string, Record<string, unknown>> = { capabilityId: { const: capability.id } };
    for (const [field, value] of Object.entries(capability)) if (exactFields.has(field)) conditions[field] = { const: value };
    (rules[capability.type] ??= []).push([10, 0, conditions, 0]);
  }
  const toolSchemas = Object.fromEntries(['send', 'approve', 'swap', 'whitelist', 'read_secret', 'http_request', 'sign'].map(tool => [tool, {
    type: 'object', properties: { capabilityId: { type: 'string' } }, required: ['capabilityId'], additionalProperties: true,
  }]));
  progentPolicies.set(result, compileProgentPolicy(rules, toolSchemas));
  compiled.add(result);
  return result;
}
export function payloadSha256(body: string): string { return createHash('sha256').update(body, 'utf8').digest('hex'); }

export interface PolicyState {
  attemptedCalls: number;
  reservedCalls: number;
  totalGasCostWei: string;
  totalNativeCostWei: string;
  assetSpent: Record<string, string>;
  capabilityUses: Record<string, number>;
  seenActionIds: string[];
}
export function createEmptyState(): PolicyState {
  return { attemptedCalls: 0, reservedCalls: 0, totalGasCostWei: '0', totalNativeCostWei: '0', assetSpent: {}, capabilityUses: {}, seenActionIds: [] };
}
export interface Violation { code: string; message: string }
export interface Assessment { allowed: boolean; violations: Violation[]; action?: ProposedAction }

function costs(action: ProposedAction): { gas: bigint; native: bigint; asset?: string; units: bigint } {
  const gas = 'fees' in action ? BigInt(action.fees.gasLimit) * BigInt(action.fees.maxFeePerGasWei) : 0n;
  // Approvals reserve the full authorized exposure too. An approve-then-swap flow
  // deliberately needs budget for both, rather than silently ignoring allowance risk.
  const spentAsset = action.type === 'send' || action.type === 'approve' ? action.asset : action.type === 'swap' ? action.assetIn : undefined;
  const units = action.type === 'send' || action.type === 'approve' ? BigInt(action.amountUnits) : action.type === 'swap' ? BigInt(action.amountInUnits) : 0n;
  return { gas, native: gas + (spentAsset === 'native' ? units : 0n), asset: spentAsset, units };
}
function malformed(): Assessment { return { allowed: false, violations: [{ code: 'MALFORMED_ACTION', message: 'Unknown or malformed action; unsupported fields are rejected.' }] }; }

/** Pure verdict. State and clock are trusted host inputs, never fields supplied by the skill. */
export function assessAction(policy: TrustedPolicy, input: unknown, state: PolicyState, nowSeconds: number): Assessment {
  if (!compiled.has(policy)) throw new Error('Expected a policy created by compilePolicy');
  const parsed = ActionSchema.safeParse(input);
  if (!parsed.success) return malformed();
  const action = parsed.data, violations: Violation[] = [];
  const deny = (code: string, message: string) => violations.push({ code, message });
  const guardedArguments = action.type === 'http_request' ? { ...action, bodySha256: payloadSha256(action.body) } : action;
  const progent = evaluateProgentCall(progentPolicies.get(policy)!, action.type, guardedArguments);
  if (!progent.allowed) deny('PROGENT_POLICY', `Progent static policy checker denied the action: ${progent.reason}.`);
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0 || nowSeconds >= policy.expiresAtSeconds) deny('POLICY_EXPIRED', 'Policy is expired or trusted time is invalid.');
  if (state.attemptedCalls >= policy.maxAttempts) deny('ATTEMPT_LIMIT', 'Attempt limit exhausted.');
  if (state.seenActionIds.includes(action.id)) deny('REPLAY', 'Action ID was already attempted in this session.');
  if (state.reservedCalls >= policy.maxCalls) deny('CALL_LIMIT', 'Authorized call budget exhausted.');
  if ('chainId' in action && action.chainId !== policy.chainId) deny('CHAIN_MISMATCH', 'Chain is outside the trusted policy.');
  if ('sender' in action && action.sender !== policy.wallet) deny('SENDER_MISMATCH', 'Sender is outside the trusted policy.');
  if (action.type === 'sign' && action.signer !== policy.wallet) deny('SIGNER_MISMATCH', 'Signer is outside the trusted policy.');
  if (action.type === 'read_secret') deny('SECRET_ACCESS', 'Private keys, seed phrases and credentials are never exposed to the agent.');
  const capability = policy.capabilities.find(item => item.id === action.capabilityId);
  if (!capability || capability.type !== action.type) deny('CAPABILITY_MISSING', 'No matching trusted capability for this action.');
  else {
    if ((Object.hasOwn(state.capabilityUses, capability.id) ? state.capabilityUses[capability.id]! : 0) >= capability.maxUses)
      deny('CAPABILITY_EXHAUSTED', 'Capability use count exhausted.');
    const exact = (actual: unknown, expected: unknown, field: string) => {
      if (actual !== expected) deny('AUTHORIZATION_MISMATCH', `${field} differs from the exact trusted authorization.`);
    };
    if (action.type === 'send' && capability.type === 'send') {
      exact(action.asset, capability.asset, 'Asset'); exact(action.recipient, capability.recipient, 'Recipient'); exact(action.amountUnits, capability.amountUnits, 'Amount');
    } else if (action.type === 'approve' && capability.type === 'approve') {
      exact(action.asset, capability.asset, 'Token'); exact(action.spender, capability.spender, 'Spender'); exact(action.amountUnits, capability.amountUnits, 'Allowance');
    } else if (action.type === 'swap' && capability.type === 'swap') {
      exact(action.router, capability.router, 'Router'); exact(action.assetIn, capability.assetIn, 'Input asset'); exact(action.assetOut, capability.assetOut, 'Output asset');
      exact(action.amountInUnits, capability.amountInUnits, 'Input amount'); exact(action.recipient, capability.recipient, 'Output recipient');
      if (action.slippageBps > capability.maxSlippageBps) deny('SLIPPAGE_LIMIT', 'Slippage exceeds the trusted limit.');
      // Integer cross-multiplication avoids floating point and rounding-down weak minima.
      if (BigInt(action.minimumOutUnits) < BigInt(capability.minimumOutUnits)
        || BigInt(action.minimumOutUnits) * 10000n < BigInt(capability.quotedOutUnits) * BigInt(10000 - action.slippageBps))
        deny('MINIMUM_OUTPUT', 'Minimum output fails the trusted quote or absolute minimum.');
      if (action.deadlineSeconds <= nowSeconds || action.deadlineSeconds > capability.maxDeadlineSeconds || action.deadlineSeconds > policy.expiresAtSeconds)
        deny('SWAP_DEADLINE', 'Swap deadline is expired or exceeds authorization.');
    } else if (action.type === 'whitelist' && capability.type === 'whitelist') {
      exact(action.address, capability.address, 'Whitelist address'); exact(action.operation, capability.operation, 'Whitelist operation');
    } else if (action.type === 'http_request' && capability.type === 'http_request') {
      exact(action.url, capability.url, 'URL'); exact(action.method, capability.method, 'HTTP method');
      if (payloadSha256(action.body) !== capability.bodySha256) deny('EGRESS_PAYLOAD', 'Outbound payload differs from the exact trusted payload digest.');
      if (action.method === 'GET' && action.body !== '') deny('HTTP_GET_BODY', 'GET with a body is unsupported.');
    } else if (action.type === 'sign' && capability.type === 'sign') {
      exact(action.digest, capability.digest, 'Signing digest'); exact(action.domainSeparator, capability.domainSeparator, 'Signing domain');
    }
  }
  if (action.type === 'approve' && action.amountUnits === UINT256_MAX) deny('UNLIMITED_APPROVAL', 'Unlimited approval is never permitted.');
  if ('fees' in action) {
    const fees = action.fees;
    if (BigInt(fees.maxPriorityFeePerGasWei) > BigInt(fees.maxFeePerGasWei)) deny('INVALID_FEES', 'Priority fee exceeds the total fee cap.');
    for (const field of ['gasLimit', 'maxFeePerGasWei', 'maxPriorityFeePerGasWei'] as const)
      if (BigInt(fees[field]) > BigInt(policy.feeLimits[field])) deny('FEE_LIMIT', `${field} exceeds the trusted limit.`);
  }
  const cost = costs(action);
  if (BigInt(state.totalGasCostWei) + cost.gas > BigInt(policy.maxTotalGasCostWei)) deny('GAS_BUDGET', 'Cumulative maximum gas cost exceeds budget.');
  if (BigInt(state.totalNativeCostWei) + cost.native > BigInt(policy.maxNativeCostWei)) deny('NATIVE_BUDGET', 'Value plus maximum gas cost exceeds the native budget.');
  if (cost.asset) {
    const budget = policy.assetBudgets.find(item => item.asset === cost.asset);
    if (!budget || BigInt(state.assetSpent[cost.asset] ?? '0') + cost.units > BigInt(budget.maxUnits)) deny('ASSET_BUDGET', 'Cumulative asset spend exceeds its explicit budget.');
  }
  return { allowed: violations.length === 0, violations, action };
}

export type EffectExecutor = (action: Readonly<ProposedAction>) => Promise<{ status: 'executed' | 'not_executed'; evidenceId?: string }>;
export interface AttemptRecord {
  sequence: number;
  actionId?: string;
  actionType?: ProposedAction['type'];
  actionSha256?: string;
  allowed: boolean;
  violations: Violation[];
  effect: 'blocked' | 'pending' | 'executed' | 'not_executed' | 'unknown';
  evidenceId?: string;
}
export interface MediationResult { assessment: Assessment; record: AttemptRecord }

/**
 * The executor is trusted host code. It must implement exactly the frozen typed action,
 * expose no alternative tools/secrets, disable HTTP redirects, and verify chain effects.
 * No budget is released after a timeout/error: an effect may already have happened.
 */
export function createSecurityMediator(policy: TrustedPolicy, executor: EffectExecutor, options: { nowSeconds: () => number }) {
  if (!compiled.has(policy)) throw new Error('Expected a policy created by compilePolicy');
  const state = createEmptyState(), records: AttemptRecord[] = [];
  return {
    snapshot: () => structuredClone({ state, records }),
    async mediate(input: unknown): Promise<MediationResult> {
      // Copy/parse and reserve synchronously before the first await. Concurrent callers
      // cannot reuse a capability while an earlier effect is pending.
      const assessment = assessAction(policy, input, state, options.nowSeconds());
      const action = assessment.action;
      const record: AttemptRecord = { sequence: state.attemptedCalls + 1, allowed: assessment.allowed, violations: structuredClone(assessment.violations), effect: 'blocked' };
      if (action) {
        record.actionId = action.id; record.actionType = action.type;
        // Logs contain only a digest, never raw HTTP payloads, signatures or secret values.
        record.actionSha256 = payloadSha256(JSON.stringify(action));
      }
      if (state.attemptedCalls < policy.maxAttempts) {
        state.attemptedCalls++;
        if (action && !state.seenActionIds.includes(action.id)) state.seenActionIds.push(action.id);
        records.push(record);
      }
      if (!assessment.allowed || !action) return { assessment, record: structuredClone(record) };
      const cost = costs(action);
      state.reservedCalls++;
      state.capabilityUses[action.capabilityId] = (Object.hasOwn(state.capabilityUses, action.capabilityId) ? state.capabilityUses[action.capabilityId]! : 0) + 1;
      state.totalGasCostWei = (BigInt(state.totalGasCostWei) + cost.gas).toString();
      state.totalNativeCostWei = (BigInt(state.totalNativeCostWei) + cost.native).toString();
      if (cost.asset) state.assetSpent[cost.asset] = (BigInt(state.assetSpent[cost.asset] ?? '0') + cost.units).toString();
      record.effect = 'pending';
      try {
        const effect = await executor(freeze(action));
        if (!effect || !['executed', 'not_executed'].includes(effect.status)
          || (effect.evidenceId !== undefined && !/^[a-zA-Z0-9:_-]{1,160}$/.test(effect.evidenceId))) throw new Error('Invalid effect result');
        record.effect = effect.status;
        if (effect.evidenceId) record.evidenceId = effect.evidenceId;
      } catch {
        // Exception strings may contain secrets or raw request bodies. Do not retain them.
        record.effect = 'unknown';
      }
      return { assessment, record: structuredClone(record) };
    },
  };
}
