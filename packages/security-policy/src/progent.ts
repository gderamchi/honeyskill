/**
 * Static JSON-Schema/fallback=0 port of Progent's published reference checker.
 * Upstream: sunblaze-ucb/progent, 5be7b63fa96f70bc19b72fbcee81f1c0bcc1a565,
 * secagent/tool.py: sort_policy, check_arg, _check_tool_call, check_tool_call.
 * Copyright (c) 2026 Progent. MIT; see docs/research/security-v1-progent.md.
 */
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { z } from 'zod';

export const PROGENT_REFERENCE = Object.freeze({
  repository: 'https://github.com/sunblaze-ucb/progent',
  commit: '5be7b63fa96f70bc19b72fbcee81f1c0bcc1a565',
  source: 'secagent/tool.py',
  sourceSha256: '59b2cd642a9c29f2459e919720fae935a5f6f99a2a5fa0c17f1ea95e9efbcd52',
  license: 'MIT',
  implementation: 'static-jsonschema-fallback-0-port-with-strict-input-boundary',
});
const name = z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$(?![\s\S])/).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value));
const schemaObject = z.record(z.string(), z.unknown());
const ruleSchema = z.tuple([z.number().int().min(0).max(1000000), z.union([z.literal(0), z.literal(1)]), z.record(name, schemaObject), z.literal(0)]);
export const ProgentPolicySchema = z.record(name, z.array(ruleSchema).max(100));
export type ProgentPolicy = z.infer<typeof ProgentPolicySchema>;
interface Rule { priority: number; effect: 0 | 1; originalIndex: number; conditions: Array<[string, ValidateFunction]> }
interface CompiledData { tools: Map<string, ValidateFunction>; rules: Map<string, Rule[]> }
declare const progentBrand: unique symbol;
export type CompiledProgentPolicy = { readonly reference: typeof PROGENT_REFERENCE; readonly [progentBrand]: true };
const compiled = new WeakMap<object, CompiledData>();

function checkSchemaBoundary(value: unknown, depth = 0): void {
  if (depth > 32) throw new Error('Policy schema nesting limit exceeded');
  if (value && typeof value === 'object') for (const [key, nested] of Object.entries(value)) {
    if (key === '$async') throw new Error('Asynchronous schema validation is not supported');
    if ((key === '$ref' || key === '$dynamicRef') && typeof nested === 'string' && !nested.startsWith('#'))
      throw new Error('Only local JSON Schema references are supported');
    checkSchemaBoundary(nested, depth + 1);
  }
}

/** Policy and tool schemas must be supplied by trusted host code, never the agent. */
export function compileProgentPolicy(input: unknown, toolSchemas: Record<string, object>): CompiledProgentPolicy {
  const policy = ProgentPolicySchema.parse(input);
  if (Object.keys(policy).length > 100 || Object.keys(toolSchemas).length > 100) throw new Error('Tool count limit exceeded');
  // Python jsonschema.validate does not enforce formats by default. Preserve that
  // behavior; authorization should use const/enum/pattern, not format annotations.
  const ajv = new Ajv2020({ strictSchema: true, strictTypes: false, strictTuples: false, strictRequired: false,
    allowUnionTypes: true, validateFormats: false, ownProperties: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  const data: CompiledData = { tools: new Map(), rules: new Map() };
  const validator = (schema: object) => {
    const copy = structuredClone(schema);
    checkSchemaBoundary(copy);
    return ajv.compile(copy);
  };
  for (const [tool, schema] of Object.entries(toolSchemas)) {
    name.parse(tool);
    data.tools.set(tool, validator(schema));
  }
  for (const [tool, rules] of Object.entries(policy)) {
    if (!data.tools.has(tool)) throw new Error(`Missing trusted argument schema for tool ${tool}`);
    data.rules.set(tool, rules.map(([priority, effect, conditions], originalIndex) => ({ priority, effect, originalIndex,
      conditions: Object.entries(conditions).map(([argument, schema]) => [argument, validator(schema)] as [string, ValidateFunction]),
    })).sort((a, b) => a.priority - b.priority || b.effect - a.effect));
  }
  const result = Object.freeze({ reference: PROGENT_REFERENCE }) as CompiledProgentPolicy;
  compiled.set(result, data);
  return result;
}

export interface ProgentDecision {
  allowed: boolean;
  reason: 'allow' | 'forbid' | 'default-deny' | 'invalid-input' | 'missing-argument' | 'priority-100-restriction';
  matchedPolicyIndex?: number;
  priority?: number;
  effect?: 0 | 1;
}

export function evaluateProgentCall(policy: CompiledProgentPolicy, toolName: string, args: unknown): ProgentDecision {
  const data = compiled.get(policy);
  if (!data) throw new Error('Expected a policy created by compileProgentPolicy');
  const schema = data.tools.get(toolName);
  if (!schema) return { allowed: false, reason: 'default-deny' };
  if (!args || typeof args !== 'object' || Array.isArray(args) || !schema(args)) return { allowed: false, reason: 'invalid-input' };
  const values = args as Record<string, unknown>;
  const rules = data.rules.get(toolName) ?? [];
  for (const rule of rules) {
    // Upstream ignores restrictions whose argument is absent. This strict boundary
    // refuses that ambiguity instead of silently widening an authorization.
    if (rule.conditions.some(([argument]) => !Object.hasOwn(values, argument))) return { allowed: false, reason: 'missing-argument' };
    const matches = rule.conditions.every(([argument, validate]) => validate(values[argument]));
    const details = { matchedPolicyIndex: rule.originalIndex, priority: rule.priority, effect: rule.effect };
    if (rule.effect === 0) {
      if (matches) return { allowed: true, reason: 'allow', ...details };
      // Preserve the reference implementation's special generated-policy priority.
      if (rule.priority === 100) return { allowed: false, reason: 'priority-100-restriction', ...details };
    } else if (matches) return { allowed: false, reason: 'forbid', ...details };
  }
  return { allowed: false, reason: 'default-deny' };
}
