# Progent static policy-checker replication

Date: 2026-10-11. Status: implemented and integrated into the new financial mediator; pinned-upstream parity executed locally. This is a replication of a declared deterministic checker subset, not the whole Progent agent framework or its published benchmark.

## Primary references and exact source

- Paper: [Progent: Programmable Privilege Control for LLM Agents, v2](https://arxiv.org/html/2504.11703v2), sections 4.1–4.3 and Algorithms 2–3. The paper places programmable argument restrictions before tool execution, with policy priorities and default denial. It also describes dynamic updates, fallback operations and an agent-level evaluation that are outside this replication.
- Official implementation: [sunblaze-ucb/progent](https://github.com/sunblaze-ucb/progent), commit `5be7b63fa96f70bc19b72fbcee81f1c0bcc1a565`.
- Source inspected: [`secagent/tool.py`](https://github.com/sunblaze-ucb/progent/blob/5be7b63fa96f70bc19b72fbcee81f1c0bcc1a565/secagent/tool.py), particularly `sort_policy`, `check_arg`, `_check_tool_call` and `check_tool_call`.
- Source SHA-256: `59b2cd642a9c29f2459e919720fae935a5f6f99a2a5fa0c17f1ea95e9efbcd52`.
- [Upstream MIT license](https://github.com/sunblaze-ucb/progent/blob/5be7b63fa96f70bc19b72fbcee81f1c0bcc1a565/LICENSE), SHA-256 `edf91d27e4acd6f0db848aae9032bee8674ce0eb85ca380667414e135a39ea0a`.

**Priority discrepancy:** the paper's prose says descending priority order. The pinned implementation sorts by `(priority, -effect)`, so **smaller numeric priorities run first, and forbid precedes allow at equal priority**. This port follows the executable reference and has explicit tests for this behavior. It also preserves the reference's priority-100 failed-allow early-denial rule.

## Implemented subset

`packages/security-policy/src/progent.ts` implements the official static policy representation:

```ts
{
  send: [
    [1, 1, { recipient: { const: "blocked" } }, 0],
    [2, 0, { recipient: { enum: ["alice"] } }, 0],
  ],
}
```

Each tuple contains priority, effect (`0` allow / `1` forbid), per-argument JSON Schemas, and fallback `0`. Matching conditions are conjunctive; the first matching rule determines the decision. Unmatched calls default to denial. Conditions use Ajv `8.20.0` with JSON Schema 2020-12 support; the reference parity uses Python `jsonschema 4.23.0`. This avoids inventing a replacement schema language or treating an LLM judgment as authorization.

`compileProgentPolicy(policy, toolSchemas)` requires an explicit trusted policy and trusted tool-input schemas. `evaluateProgentCall` validates the input, applies the compiled restrictions and returns the decision plus its rule provenance. Policies and schemas are cloned during compilation and are not exposed as mutable runtime authority.

Unsupported features are rejected: Python callable restrictions, regex-string shorthand, fallback 1/2, dynamic update tuples, asynchronous schemas and external schema references. JSON Schema regular expressions remain available; parity covers portable patterns, not every Python/ECMAScript regex dialect difference. Format annotations are not enforced, matching Python `jsonschema.validate` without a format checker; use explicit `const`, `enum`, or supported pattern constraints for authorization. Unknown schema keywords cause compilation errors.

## Explicit hardening differences

The reference permits unrestricted calls when the policy is `None`; this module rejects a missing policy. The reference skips an argument restriction when that argument is absent. This module validates required tool arguments before matching and denies a missing constrained argument. These are intentional stricter boundaries, not silently claimed parity. A local upstream test confirms the reference allows the missing-argument example and HoneySkill rejects it.

No LLM can generate or update an active policy through this API. No human override is implemented in the checker. The trusted host remains responsible for correct policy definitions and complete tool mediation. Tool parameters that violate a schema are denied before an effect callback.

## Integration into blockchain protection

`compilePolicy` in `index.ts` converts host-issued financial capabilities into Progent argument constraints. Secret-read actions get an unconditional forbid rule. Every successfully parsed proposed action passes through `evaluateProgentCall` inside `assessAction`; there is no optional bypass flag. Rejections record `PROGENT_POLICY` alongside the specific financial violations.

The blockchain extension then applies exact integer arithmetic, cumulative budgets, fee bounds, quote-based minimum output, expiry and stateful replay protection. These additional checks are extensions, not results copied from the Progent paper. Neither this port nor the extension claims to implement CaMeL's interpreter or information-flow analysis.

## Parity evidence

`tests/security-progent.test.ts` contains 28 declared common-subset cases covering priority ordering, forbid ties, default denial, conjunction, enum/const, numeric boundaries, boolean schema composition, arrays, portable patterns and priority 100. The optional reference test:

1. Verifies the source file SHA-256 against the pinned commit.
2. Parses its Python AST and loads only the five reviewed checker definitions. It does not import provider integrations or execute agents.
3. Runs identical policy/argument cases through the original Python definitions and this TypeScript port.
4. Verifies the separately documented missing-argument hardening difference.

Local result on 2026-10-11: **28/28 common-subset decisions match; zero mismatches; one expected hardening difference confirmed.** All 33 Progent tests passed. The independent financial suite also passed all 53 tests after integration. These figures establish consistency on these cases, not equivalence for every JSON Schema or an independently replicated malware-detection result.

The reference checkout and Python environment are optional ignored research assets. A clean clone runs portable checker tests but skips upstream execution unless these assets are supplied. Run:

```sh
node --import tsx --test tests/security-progent.test.ts
```

`SKILLGATE_PROGENT_REFERENCE` may specify the pinned `secagent/tool.py`; `SKILLGATE_PROGENT_PYTHON` may specify a Python executable with the pinned jsonschema version. `SKILLGATE_PROGENT_EVIDENCE` optionally saves sanitized case-level parity JSON. This evidence contains policy fixtures and results, not workstation paths, credentials or raw logs. No API credits, wallet, RPC or malware execution is involved.

## Upstream license notice

MIT License

Copyright (c) 2026 Progent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
