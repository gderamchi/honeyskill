# Deterministic financial tool policy v1

Date: 2026-10-11. Status: implemented bounded reference monitor and offline regressions. This module is separate from the frozen SkillGuard-Lite experiments and does not alter their historical oracle or results.

The mediator now also uses the [replicated Progent static checker](security-v1-progent.md) on every typed action, followed by the financial arithmetic and state checks described below. Progent parity and financial regression results are separate measurements.

## Research basis and replication boundary

[CaMeL, sections 5.2–5.4](https://arxiv.org/html/2503.18813v2) enforces tool policies outside the model, with capabilities and a provenance-tracking interpreter. HoneySkill adopts the narrower enforcement boundary: an untrusted model may propose a typed action; trusted host code determines whether its exact parameters are authorized before dispatch. **This is not a CaMeL reimplementation.** There is no privileged/quarantined dual-model interpreter, no general value-level provenance graph, no information-flow proof and no reproduction of the paper's benchmark. The model does not compile its own authority.

Financial checks follow primary protocol documentation:

- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) specifies gas limit, maximum fee and priority fee. The monitor bounds each field and reserves `gasLimit × maxFeePerGasWei` before execution. Native value plus this upper bound has a separate cumulative limit.
- [ERC-20](https://eips.ethereum.org/EIPS/eip-20) defines allowance by token, spender and amount. The monitor requires exact authorization, denies maximum-uint256 approval, and reserves allowance exposure against the token budget. It does not solve allowance-update races on-chain or verify a token implementation.
- [Uniswap v3 single-swap documentation](https://developers.uniswap.org/docs/protocols/v3/guides/swapping/single-hop-swapping) identifies input/output assets, recipient, deadline and minimum output as essential parameters, and warns that minimum output requires an independent price source. This policy accepts a quote only from its trusted caller, checks the absolute minimum and computes the slippage bound with integers. It neither fetches nor validates a market oracle and does not execute Uniswap contracts.

These sources justify specific mechanisms. Their empirical results or guarantees are not results or guarantees of HoneySkill.

## Trust boundary

`compilePolicy(trustedInput)` parses, clones and freezes a host-issued task policy. Never pass skill contents, tool arguments or unreviewed model-generated policy to this function. `createSecurityMediator` accepts the compiled policy separately from candidate actions. No candidate field can add a capability, whitelist entry or budget. Unknown fields are rejected.

Only the mediator owns session state. It reserves capability uses, budgets and action IDs synchronously before awaiting the executor, preventing concurrent calls from overspending the same authorization. Budgets remain reserved even after an error or a reported non-execution; an ambiguous operation may already have produced effects. The mediator is single-process and in-memory: it is not a persistent distributed transaction coordinator. Recreating it creates a new session, so a real host must not reset authorization state to retry a payment.

`assessAction` is a pure diagnostic function over trusted policy, trusted ledger state and trusted time. Use `mediate` for effects; calling `assessAction` with a fabricated empty state is not equivalent to stateful enforcement.

## Action coverage

| Family | Allowed only when | Rejected examples |
| --- | --- | --- |
| `send` | Exact chain, sender, asset, recipient, amount and remaining budgets | Different contact, amount change, duplicate call, wrong chain |
| `approve` | Exact token/spender/allowance and bounded exposure | Unlimited approval, unexpected spender, raised allowance |
| `swap` | Exact router/input/output/recipient/input amount, sufficient minimum output, bounded slippage and live deadline | Unexpected swap, redirected proceeds, weakened minimum, excessive slippage |
| `whitelist` | Exact host-issued address and add/remove operation | Model-requested trust expansion |
| `read_secret` | Never | Private keys, seed phrases and credentials |
| `http_request` | Exact preauthorized HTTPS URL, method and body SHA-256 | New destination, changed query/body, extra headers or self-declared “not secret” labels |
| `sign` | Exact host-authorized EIP-712 digest, domain separator, signer and chain | Arbitrary signing, domain substitution, unsupported signing formats |

Amounts use canonical decimal uint256 strings and `BigInt`, never floating-point currency arithmetic. Address case is normalized. No calldata, generic contract call, shell, file reader, arbitrary script, NFT operator approval, permit, bridge, staking operation or account abstraction action is supported by this action model. Rejecting an unsupported operation prevents dispatch through this monitor but does not establish that an entire skill has been evaluated.

Approval exposure and subsequent token spending are both conservatively reserved. For example, approving 100 units then swapping 100 requires a 200-unit reservation budget. This is an intentionally conservative exposure accounting rule, not a claim that the wallet transferred 200 tokens.

## Adapter obligations and limitations

The injected executor is trusted code, not an LLM-produced function. It must implement exactly the frozen action, expose no bypass tools, avoid loading secrets into model context, disable HTTP redirects and implicit secret-bearing headers, and verify actual effects. A typed `send` must not silently become arbitrary calldata. A typed `swap` is an authorization abstraction, not proof that a router is honest or that tokens have standard behavior. On-chain amounts, chain state, receipt success, allowance transitions and emitted/state-derived asset effects need independently tested adapters.

This package supplies **no real wallet, HTTP dispatcher, signing service or swap executor**. Its tests use instrumented in-memory callbacks. An `executed` record means that this supplied callback reported execution; this package alone cannot authenticate that claim. It retains an evidence identifier, not raw receipts. Production chain adapters are a separate validation boundary.

Secret protection relies on denying secret access and allowing only exact host-authorized outbound data. It is not a detector for all encodings of unknown secrets. A caller that authorizes an outbound secret digest or exposes an unmediated secret-reading tool violates the threat model. No real secrets are loaded by this module.

Attempt records contain action digests and violation codes, never raw HTTP payloads or exception strings. Returned assessments contain the parsed candidate for host use and must not be blindly logged when callers submit confidential data. Report hashes establish consistency, not the independent authenticity of a remote provider or blockchain.

## Reproducible offline evidence

`runPolicyBenchmark(seed = 20261011)` in `packages/security-policy/src/benchmark.ts` returns every explicit policy, proposed action, independently authored expected decision, actual decision, violation codes, callback count and effect outcome. Its kind is `deterministic-tool-mediation-regression`. It contains 26 authored action cases plus 16 generated variants, with legitimate counterparts for the supported threat families. Seeded generation changes trusted addresses and exact integer amounts. It does not generate malware or execute acquired code.

Each saved case can be independently replayed through:

```ts
assessAction(
  compilePolicy(savedCase.policy),
  savedCase.action,
  createEmptyState(),
  benchmark.trustedNowSeconds,
);
```

In this regression only, TP means an unauthorized proposed action was blocked; TN means an authorized proposed action was allowed. FP is a blocked authorized action; FN is an allowed unauthorized action. These counts are **not skill-malware detection accuracy**, and correlated generated variants are not independent skills. The raw cases make the labels and policy assumptions reviewable. Replaying validates deterministic decisions, not the ground truth's external validity.

Local validation on 2026-10-11: 53 tests passed, including exact integers, malformed inputs, denied tool dispatch, retained budgets after errors, duplicate/racing calls, immutable state, 128 generated contract variations and reproducible benchmark replay. The offline benchmark yielded 42/42 expected decisions: TP 26, TN 16, FP 0, FN 0. No API credits, network requests, wallet or chain execution were involved in these measurements.

Run the targeted suite with `node --import tsx --test tests/security-policy.test.ts`. The CLI entry for publishing the benchmark output is maintained by the integration layer. Never relabel these offline results as live model or real-malware evidence.

## Actual owned-local-chain integration proof

`packages/security-lab/src/chain-proof.ts` exports `runChainProof()`. It starts its own loopback-only Anvil process on an ephemeral port, verifies the client and chain identity, creates an in-memory throwaway signer, funds it only through the owned local RPC, and mediates native transfers. There is no configurable transaction RPC URL or key input. The process is terminated and temporary directory removed after the run.

The trusted policy authorizes one exact 0.001 local-test-ETH payment to an empty-code account on chain 31337. EIP-1559 fee ceilings derive from the trusted local block. The executor constructs recipient, value, gas, maximum fee, priority fee and empty calldata directly from the immutable validated action; it does not accept raw model-generated transaction data.

On 2026-10-11, the actual local run recorded five attempts: changed recipient, changed amount and raised fee were blocked before dispatch; the authorized payment mined successfully; replay was blocked. All 16 assertions passed. The rejected calls invoked the executor zero times and left balances, sender nonce and block number unchanged. The one executed payment produced the exact recipient delta; the sender lost only the value plus receipt-derived gas fees. Replay left the observed chain state unchanged. The saved record includes sanitized transaction fields, receipt, balances, policy and decisions.

This is **actual local chain evidence on synthetic actions**, not a skill-malware or model-detection benchmark. It uses a fresh local genesis, not a public network or a Fuji fork. Swaps, approvals and other action families remain offline policy tests. No acquired skill, API model, public RPC or real wallet participates.

The live regression is opt-in: `SKILLGATE_LIVE_CHAIN_PROOF=1 node --import tsx --test tests/security-chain-proof.test.ts`. A normal offline test run skips it; do not report a skipped run as newly executed chain evidence.
