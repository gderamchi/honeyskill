# Security v1 — local results, 2026-10-11

Local version: **0.6.0-dev.0**, not published. The offline evaluator and bounded authorization monitor work as inspectable implementations, but the present static detector is **not an effective general malware classifier** on this development corpus. Live LLM evaluation and an independently adjudicated holdout remain outstanding. Published 0.5.0 and its frozen experiments are unchanged.

## Package inspection results

These full runs use native rules plus the actual Cisco 2.2.2 engine, alert threshold MEDIUM, zero retries, and preserved package files. Semantic review was not requested. No acquired code or remote payload was executed. TP/FP/TN/FN use external source labels only on complete eligible packages.

| Cohort | Attempted | Scored result | Kept outside the matrix |
| --- | ---: | --- | --- |
| Externally malicious-labelled packages | 80 | TP 7, FN 25 | 48 incomplete/excluded |
| Official-source controls, label unknown | 14 | No benign/malicious score | 13 completed unknown, 1 incomplete |
| Constructed AgentTrap benign controls | 20 | FP 7, TN 12 | 1 partial analysis |

Malicious positive coverage is **32/80 = 40%**. Conditional recall is **7/32 = 21.875%**; observed detections across all labelled positives are **7/80 = 8.75%**. Exclusions remain abstentions, not false negatives. The external run therefore has 49 exclusions overall. The 14 official controls are not true negatives.

The constructed-control false-positive rate is **7/19 = 36.8%** with 19/20 coverage. This is not a real-world FPR: labels are task-conditioned, families are correlated, and nine v5 controls explicitly reveal their benign label. Do not pool these differently sourced cohorts into a headline accuracy or precision.

| Method, on identical eligible rows | TP / FN on 32 positives | FP / TN on 19 constructed negatives |
| --- | --- | --- |
| Native rules | 3 / 29 | 3 / 16 |
| Cisco | 7 / 25 | 4 / 15 |
| Combined OR | 7 / 25 | 7 / 12 |

Cisco adds four detections over native on the paired positives. The union has no gain over Cisco there, while their false alerts are disjoint. Standalone native has a different eligible set (4 TP / 34 FN on 38 positives), so those raw totals are not the paired comparison above.

Review every case, source label, exact finding and exclusion in the [external HTML](external/index.html), [external JSON](external/benchmark.json), [control HTML](controls/index.html) and [control JSON](controls/benchmark.json). The [error analysis](../../research/security-v1-error-analysis.md) explains concrete TP/FN/FP examples, all misses, source differences and coverage losses. Source metadata and label limitations are in the [source ledger](../../research/security-v1-source-ledger.md).

## Separate enforcement evidence

- [Progent parity](progent-parity.json): the declared common static-checker subset agrees with the pinned reference; the [replication record](../../research/security-v1-progent.md) states the tested boundary and intentional hardening differences.
- [Financial policy regression](policy.json): 42 authored/generated proposed-action cases, zero expected-decision failures. These are authorization cases, not 42 malicious skills.
- [Actual local-chain proof](chain-proof.json): five synthetic proposed actions, all 16 assertions passed. Recipient/amount/fee changes and replay were denied before dispatch. One exact authorized native payment mined; transaction fields, receipt, balances, gas cost and nonce were checked. The packaged CLI was exercised against an owned fresh Anvil genesis on chain 31337, with an in-memory throwaway key, no public RPC and no model call. Approvals/swaps remain offline policy checks.

This proves the tested bounded monitor integration. It does not prove prevention of a real blockchain-malware campaign or protection of unmediated tools.

## Local validation and reproducibility

[Validation record](validation.json): **251 application tests passed, 2 optional tests skipped; 74 preserved behavioral tests passed, 1 optional live-Fuji test skipped**. Actual Cisco and local-chain evidence were exercised separately. Typecheck, CLI build, local pack, legacy offline package smoke and new packaged security smoke passed. These are local results; **CI was not run**.

The [package smoke](package-smoke.json) verifies the local development CLI with Cisco 2.2.2, complete offline inspection and 42 policy cases. [Runtime provenance](runtime-provenance.json) records dependencies; [report UI validation](report-ui-validation.json) records report inspection. Corpus integrity covers 114 cases / 616 inert files. Both record verifiers passed. No model API requests were made: an authorized OpenAI key was unavailable.

Both final benchmarks use source-freeze SHA-256 `0b40338c6dcee29e3e234f6c966f677b3e8e5d97510ea88e3a3fdb4af19ddcf2`. Their [external freeze](external/freeze.json) and [control freeze](controls/freeze.json) preserve selected IDs and configuration. Earlier pilots/failures were retained locally; final runs followed driver/report fixes without tuning detector thresholds or corpus labels. Hashes and recalculation demonstrate record consistency, not independent label correctness or external attestation.

Next: supply an authorized API environment for the live semantic/guarded-model lanes, then run the [preregistered independent holdout protocol](../../SECURITY_V1.md#preregister-the-next-independent-run). Current data are development evidence, not unseen scientific validation of the entire pipeline.
