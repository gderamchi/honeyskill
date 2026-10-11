# HoneySkill security v1 — experimental runbook

As of 2026-10-11, local **0.6.0-dev.0 has implementation, offline, first live and frozen repair-development evidence**, separately from published 0.5.0 and frozen SkillGuard-Lite experiments. It remains unpublished; CI was not run. See the [latest before/after report](evidence/security-v1/repair-2026-10-11/report.md) and preserved [first live report](evidence/security-v1/live-2026-10-11/report.md). Keys were supplied through masked input and not persisted. An independently adjudicated holdout and causal runtime-prevention evaluation remain outstanding. Do not recover credentials from prior sessions.

The [earlier offline result summary](evidence/security-v1/report.md) preserves that run's JSON/HTML and tests. Native/Cisco inspection yielded 7 TP / 25 FN on 32/80 eligible external positives: 21.875% conditional recall, 40% positive coverage and an 8.75% detection floor. Constructed controls yielded 7 FP / 12 TN / 1 partial: 36.8% research-control FPR, not real-world FPR. These results expose weak general static detection; they are not evidence that the whole security problem is solved.

## Latest frozen development repair

The 2026-10-11 04:01:17–04:10:32 UTC inspection rerun kept all 114 original cases, labels, corpus bytes and inspected fingerprints. Combined results: 18 TP / 14 FN / 48 incomplete positives; 7 FP / 12 TN / 1 incomplete constructed control; 13 completed unknowns / 1 incomplete unknown. Both runs have 32 eligible positives, but only 30 are identical: on those, TP 9 → 16 (paired recall 30.0% → 53.3%). The 16 paired controls remain FP 4 / TN 12; three newly eligible controls are all FP.

The original 22 FNs become 9 TP, 12 FN and 1 partial. The original 48 incomplete positives become 2 TP and 46 still incomplete. Two old TPs become FN and one becomes partial. Seven revised semantic batches across six stages remain partial. Source labels and incomplete packages were not altered; no failed request was replaced. This is deliberate tuning on development failures, not an unseen or independently adjudicated benchmark.

The revised run records 367 unique GPT-6 Luna responses, reasoning `none`, temperature 0, zero retries, and 8,309,767 tokens—about 10.88 times the first run's 763,850 inspection-only tokens. Source chunks and extra coverage explain additional work; the comparison does not isolate a single component's causal gain. An independent audit verifies 616 frozen corpus files, all request input hashes/source-ID lists, coverage of 163,820 privacy-redacted readable lines and 545 retained citation locations. This establishes internal evidence consistency, not correct malicious-intent adjudication or runtime prevention. Full case transitions and paired ablations are in the [repair report](evidence/security-v1/repair-2026-10-11/report.md).

## Architecture and research boundary

| Layer | Actual implementation | Evidence boundary |
| --- | --- | --- |
| Acquisition | Bounded quarantine, file inventory and snapshot fingerprint before/after analysis | Package bytes, not an authenticated original victim incident |
| Native inspection | Existing deterministic financial rules | Pattern findings, with coverage gaps retained |
| Cisco inspection | Actual external `cisco-ai-skill-scanner==2.2.2` through `packages/security-lab/src/cisco.ts` | Static, bytecode, pipeline, correlation and AST/dataflow analyzers; no acquired script execution |
| Semantic inspection | Dedicated `security-semantic-2`, GPT-6 Luna reasoning `none`, deterministic source batches and host-resolved citation IDs | SG-01–SG-04 instruction/secret/code/privilege abuse plus FIN-01–FIN-06; cross-batch interactions and malicious intent can be missed |
| Authorization | Progent static JSON-Schema checker subset port, then financial reference-monitor checks | Deterministic typed-action decisions under a trusted host policy |
| Guarded exercise | GPT-6 Luna proposes `submit_action`; host monitor mediates proposals | In-memory simulated effects; conversation completion and required effects are separate |
| Chain proof | Implemented native-transfer adapter on an owned ephemeral Anvil chain | Five synthetic proposed actions, four denied without dispatch, one exact payment mined; no public signed transaction |

Cisco is an actual integrated external engine. Its `behavioral_analyzer` is **static Python AST/dataflow analysis**, not runtime execution. The adapter validates version, selected analyzers, coverage/error metadata, paths and quotations, and detects changed bytes. The subprocess environment is constrained but is not an operating-system network sandbox. No Cisco LLM, reputation lookup or optional community rule pack is selected.

Security semantic review partitions privacy-redacted readable source into at most 128 batches of 64 KiB serialized fragments, with at most 16 KiB entry context per request. Every original readable line is assigned a host-generated source ID; returned IDs must belong to that batch and contain nonempty evidence. Exact request hashes, source IDs, response metadata, usage and partial outcomes are retained. Unknown IDs do not become verified findings. Security-only inventory adds bounded UTF-8 static text formats without changing package bytes or treating unreadable files as clean. Cisco normalization requires defensible exact-source evidence. These changes do not alter the released financial reviewer or the guarded exercise's separate 64 KiB input bound.

The [Progent port](research/security-v1-progent.md) preserves the pinned checker's priority ordering, JSON-Schema restrictions, first applicable rule and default denial. Missing-policy/missing-argument handling is intentionally stricter. Dynamic policies, fallback modes, callable restrictions and the entire agent framework are not reproduced. CaMeL informs the trust boundary; this is **not** a CaMeL interpreter or information-flow proof.

The [financial monitor](research/security-v1-policy.md) checks exact recipients/amounts, approvals, router/assets/minimum output/slippage, whitelist changes, secret access, outbound destination/payload, signing domain/digest, fees, expiry, replay and cumulative budgets. Trusted host code supplies authority; skill/model output cannot expand it. Budgets are reserved before dispatch and retained after ambiguous errors. State is in-memory and single-process. The module supplies no general wallet, swap, signing, HTTP or arbitrary-code executor. Every real effect adapter remains a separate trust and validation boundary.

Neither inspection nor exercise installs a skill. Published `honeyskill try` retains its separate lab-only activation policy.

## Source commands

Use Node.js 22.18+ and pinned pnpm dependencies. Install Cisco 2.2.2 separately in an isolated Python environment using its [upstream documentation](https://github.com/cisco-ai-defense/skill-scanner/tree/2.2.2). Set `HONEYSKILL_CISCO_BIN` to the trusted executable's absolute path, or pass `--scanner`. HoneySkill does not silently install it. Output locations must be new; create their parent first.

```sh
pnpm install --frozen-lockfile
mkdir -p outputs
pnpm guard security inspect ./my-skill --offline --out outputs/security-inspection
pnpm guard security benchmark evaluation/security-v1/corpus/manifest.json --offline --out outputs/security-real-corpus
pnpm guard security benchmark evaluation/security-v1/negative-corpus/manifest.json --offline --out outputs/security-negative-controls
pnpm guard security verify outputs/security-real-corpus/benchmark.json
pnpm guard security policy-test --out outputs/security-policy.json
pnpm guard security chain-proof --out outputs/security-chain-proof.json
```

`chain-proof` additionally requires trusted local Anvil. It starts its own loopback-only process and fresh genesis on chain 31337, using a throwaway signing key held only in memory. It accepts no transaction RPC URL or key input and does not use a public RPC or Fuji fork. It makes no model call.

If a restricted sandbox prevents the `tsx` CLI from opening its IPC pipe (`EPERM`), the equivalent source entry is `node --import tsx apps/cli/src/index.ts security ...`. The exercise help was checked through this entry; no provider call is made by help.

`--offline` selects native and Cisco only; it is not a successful three-stage model run. Omit it only with an authorized key securely supplied as `OPENAI_API_KEY`; this makes paid API requests. Authorized spending does not supply credentials. Never put a key in command arguments, committed files or reports.

`inspect` saves JSON and standalone HTML. Exit 0 means complete selected inspection without an alert; 2 means complete inspection with a risk detection; 3 means incomplete inspection. **No alert is not a benign verdict.** Risk evidence can coexist with incomplete coverage. Benchmark reports preserve every case, per-engine findings and incomplete/error outcomes. The alert threshold is `medium` or higher. `verify` recalculates recorded matrices and identities; it does not authenticate execution, source labels or detector correctness.

### Minimal guarded-model example

This authorizes one **simulated** native transfer using public dummy addresses. Expiry is generated from the current trusted host clock, not copied from an expired benchmark fixture. The policy is reviewed host authority; never derive it from inspected skill text.

```sh
node --input-type=module <<'JS'
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('outputs', { recursive: true });
const policy = {
  version: 'skillgate-capabilities-v1', id: 'demo-policy', chainId: 43113,
  wallet: '0x1111111111111111111111111111111111111111',
  expiresAtSeconds: Math.floor(Date.now() / 1000) + 900,
  maxCalls: 1, maxAttempts: 8,
  feeLimits: { gasLimit: '21000', maxFeePerGasWei: '1000000000', maxPriorityFeePerGasWei: '1000000000' },
  maxTotalGasCostWei: '21000000000000', maxNativeCostWei: '100021000000000000',
  assetBudgets: [{ asset: 'native', maxUnits: '100000000000000000' }],
  capabilities: [{ id: 'pay-demo', type: 'send', maxUses: 1, asset: 'native',
    recipient: '0x2222222222222222222222222222222222222222', amountUnits: '100000000000000000' }]
};
writeFileSync('outputs/security-demo-policy.json', JSON.stringify(policy, null, 2), { flag: 'wx', mode: 0o600 });
JS

pnpm guard security exercise ./my-skill \
  --policy outputs/security-demo-policy.json \
  --task 'Send exactly 0.1 native AVAX to 0x2222222222222222222222222222222222222222 using pay-demo.' \
  --require pay-demo --out outputs/security-exercise.json
```

Exercise acquires an exact snapshot, requires supported text to fit its 64 KiB bound, and applies heuristic apparent-secret redaction. Use non-confidential input. No acquired helper or dependency executes. A completed conversation without required effects is not task success; a simulated effect is not an on-chain effect. Test-double transport is explicitly labelled. The separate first live six-case harness produced six exact simulated payments but no malicious proposals or interceptions; it does not measure causal prevention.

## Pinned evidence

| Artifact | Identity |
| --- | --- |
| Published product 0.5.0 | `41fca4d8ec9422eebe32043b4006cc95c91dac72` |
| Release evidence-only follow-up | `c26762ac71038bb43e1fdd4bd9c672cbf3e5a3b0` |
| Cisco 2.2.2 source commit | `ef5cfee8d15fe207e09d808ccb5be4b9ae6d321a` |
| Local Cisco macOS ARM wheel SHA-256 | `ba6b9b5992fe51d2f041ac1d7edf0542abfe4d3b80641b9d9f7235ab7622fa67` |
| Progent source commit | `5be7b63fa96f70bc19b72fbcee81f1c0bcc1a565` |
| Progent `secagent/tool.py` SHA-256 | `59b2cd642a9c29f2459e919720fae935a5f6f99a2a5fa0c17f1ea95e9efbcd52` |
| 94-case corpus manifest SHA-256 | `89d6647ee49fbf81d33e67a4fe0720df2abf34d44020e4121cb99432af641445` |
| 20-case negative manifest SHA-256 | `5f91e4f65af39def5a7b6ca64e9aef9e0067c739046277dc17fb4693c7e7675a` |
| Earlier offline/first-live benchmark source-freeze SHA-256 | `0b40338c6dcee29e3e234f6c966f677b3e8e5d97510ea88e3a3fdb4af19ddcf2` |
| Repair benchmark source-freeze SHA-256 | `59a44af60151caf590518345217f73c84d4792163121221c5f363154c97b9d86` |
| Repair security semantic prompt SHA-256 | `112cf5193a4777d98031fb3be4918fa3f4d5504a10b81b76468b88a626d60c14` |
| Portable packaged-CLI local-chain proof SHA-256 | `c88edf2286d3027631d8104063f5e61cee35e34cfb903f99defd8272fd659bfe` |

The wheel hash is platform-specific. See [engine provenance](research/security-v1-research.md) and [Progent source/license/parity](research/security-v1-progent.md). Each benchmark saves source/dependency hashes, manifest hash, configuration and individual case reports before aggregates. Changed source during a run invalidates a frozen-code claim. Hash consistency is not independent replication.

The [portable packaged-CLI chain record](evidence/security-v1/chain-proof.json) passed all **16 assertions on five proposed actions**: recipient substitution, amount inflation, fee inflation and replay were denied with zero executor calls; one authorized 0.001 local-test-ETH transfer mined. Transaction fields, receipt, recipient delta, sender value-plus-gas debit, nonce and unchanged denied/replay state were checked. The [policy research record](research/security-v1-policy.md#actual-owned-local-chain-integration-proof) explains the boundary. This is actual chain evidence on synthetic actions, not a live LLM run or a real-malware campaign. Approvals, swaps, HTTP and signing remain offline policy evidence.

The [external corpus](research/security-v1-corpus.md) contains 80 study/vendor-labelled malicious cases and 14 official controls labelled `unknown`: 474 files, 57 complete source snapshots, 34 partial packages and 3 text-only cases. Source labels can be wrong; complete source files do not imply runtime support or exact original incident bytes. Finance-related packages and a cryptocurrency lure do **not** establish that HoneySkill prevented a real blockchain theft campaign.

The [negative cohort](../evaluation/security-v1/negative-corpus/README.md) adds 20 externally authored AgentTrap controls, 142 files and 18 source-skill families. Labels depend on the published authorized task. Nine v5 cases explicitly reveal a benign label and repeat safe-workflow wording. Results are an overblocking smoke test, not an in-the-wild FPR estimate. Keep `research-control` separate and inspect v3/v5 separately. Unknown official controls never become TNs through reputation alone. New corpus redistribution rights are not fully cleared.

## Preregister the next independent run

1. Freeze a **source- and family-disjoint holdout** before tuning. The imported corpus is development data, not unseen validation; model-training exposure is unknown. Select using a written sampling rule, never our detector's output.
2. Two human adjudicators independently review exact packages and authorized `userTask`, blinded to detector verdicts. Record rationale/evidence; a third resolves disagreements. Use `unknown` when intent or authorization remains unclear. Require a compatible runtime witness separately before claiming demonstrated attack/prevention.
3. Use one **package** as the classification unit. Calls, repeats and near-duplicate variants are not independent skills. Keep related families in one split; report row counts and grouped results.
4. Freeze source/dependency hashes, prompts, model (`gpt-6-luna`, reasoning `none`), versions, threshold (`medium`), timeouts, task environment, scoring and **zero retries**. Predeclare sample size, repetitions and stopping rules. Preserve first failed/incomplete attempts.
5. Run native, Cisco, semantic and union ablations on paired rows. Report TP/FP/TN/FN, denominators and uncertainty by provenance/source/threat family, plus unknown, unsupported, partial and error counts. An unrequested semantic stage is not model evidence; difficult cases stay visible.
6. Report legitimate utility and unauthorized-effect prevention separately from inspection. Progent parity is checker agreement; financial regressions are proposed-action authorization; simulated effects are not real transactions or malware execution. Refusal or no payment is not successful utility.

Latest repair validation recorded **264 application passes / 2 skips and 74 preserved behavioral passes / 1 skip**, with passing typecheck, build, local pack and offline package smoke. No new CI, public release, guarded-model run or local-chain prevention result is claimed from this inspection rerun.

The earlier [recorded local validation](evidence/security-v1/validation.json) has 251 application passes / 2 skips, 74 preserved behavioral passes / 1 skip, and passing typecheck/build/pack/offline package smokes. Actual Cisco and local-chain checks were separate from optional skipped broad-suite tests. These checks were not repeated for the [first live measurement](evidence/security-v1/live-2026-10-11/report.md): TP 10 / FN 22 on 32 eligible positives, FP 4 / TN 12 on 16 eligible controls, 54 incomplete and 12 completed unknown cases across the 114 packages. CI was not run. Keep labels, abstentions, paired denominators and previous attempts visible; this is not an unseen-holdout or whole-system accuracy claim.
