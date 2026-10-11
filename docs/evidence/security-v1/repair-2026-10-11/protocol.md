# SkillGate development repair evaluation protocol

Status: final protocol recorded before the revised paid requests. The launcher freezes this document, final source/dependency hashes, exact prompt/chunk limits and transport settings before the first revised request. No revised detector outcome was available when these settings were selected.

## Question and evidence boundary

Does repairing identifiable coverage/citation defects and expanding the security-only semantic review improve inspection results on the existing development corpus without hiding failures or increasing overblocking unnoticed?

This is intentionally a development-set repair evaluation. The original 22 false negatives and 48 incomplete positive-labelled cases informed the changes. The revised run cannot be called an unseen test, an unbiased estimate of generalization, or independent validation. Its usefulness is an honest, paired measurement of a disclosed development change. A separate source/family-disjoint, independently adjudicated holdout is still necessary.

Inspection is the endpoint. No acquired skill code or endpoint is executed, no skill is installed, and no real-wallet or runtime-prevention claim follows from a positive inspection result.

## Locked population and labels

Rerun every original row, once, in its manifest order: 94 external-source cases (80 malicious labels and 14 unknown) and 20 constructed, task-conditioned benign controls. Preserve original labels, provenance, case IDs, source families, original file bytes and their hashes. No case may be added, removed, relabelled, deobfuscated, patched, completed by downloading missing payloads, or selected according to outcomes.

Corpus manifest SHA-256:

- External: `89d6647ee49fbf81d33e67a4fe0720df2abf34d44020e4121cb99432af641445`
- Controls: `5f91e4f65af39def5a7b6ca64e9aef9e0067c739046277dc17fb4693c7e7675a`

The unit is one preserved skill package, not one finding, chunk or API request. Related package families are not independent samples. Official controls stay unknown, and AgentTrap control scores are not an estimate of in-the-wild false-positive rates.

## Baseline and planned repair

Preserve the first live run `live-2026-10-11T03-31-31-569Z` and its complete per-case records. The baseline combined external result is TP 10 / FN 22 on 32 eligible positives, 48 incomplete positives, 12 completed unknowns and 2 incomplete unknowns. The baseline controls are FP 4 / TN 12 / 4 unsupported. There are 54 exclusions across all 114 cases, not 48.

The declared changes are:

1. A security-specific semantic module covering financial abuse plus general instruction manipulation, unauthorized secret access/exfiltration, and code abuse. The preserved release financial reviewer and frozen historical experiments are not modified.
2. Deterministic bounded chunks cover all supported readable text, replacing the single 64 KiB refusal. No detector-selected excerpts, case-specific prompts, externally injected label metadata, or severity-threshold changes are introduced. Two original packages already contain audit.json verdict artifacts; these remain unchanged and are documented as contamination. The model is explicitly instructed not to treat prior verdicts as evidence. Chunk limits, overlap/partition policy, model context and aggregation are frozen before the run.
3. Citations use host-generated source-line identities. The host maps returned IDs to exact preserved source evidence. Unknown identities, malformed responses and missing coverage remain incomplete; they are not silently accepted or retried.
4. Safe UTF-8 inspection of additional static text formats in the security pipeline, preserving the original package inventory and fingerprint. Unsupported binary content still remains unsupported.
5. Cisco citation normalization only with exact source validation: unique excerpts, pinned coordinate reconstruction, or exact pinned secret-redaction semantics at recorded signature offsets. Ambiguous or absent evidence remains partial. The pinned Cisco engine, analyzers, policy and severity threshold stay fixed.

These changes broaden the semantic task and may increase API work per package. They are not a pure same-prompt model comparison. No claim may attribute all differences to one component without an additional matched ablation. Source-label disagreements are documented without changing the scored labels.

## Frozen batching and transport

The dedicated security-semantic-2 module partitions every readable file in lexical path order, retaining every line including blanks. Long lines are split into at most 2,048 UTF-8 bytes per source fragment; host-generated IDs bind each fragment to its original file/line. Each batch contains at most 65,536 serialized source-fragment bytes, with no overlap or model-selected truncation. The untrusted SKILL.md prefix (at most 16,384 UTF-8 bytes) and hash/path inventory are repeated as orientation. A maximum of 128 batches per package is enforced; exceeding it stays unsupported. Cross-batch interactions remain a limitation.

Each call has a 45-second deadline, 128 KiB response cap and 4,000 output-token cap. Responses must complete and satisfy the strict findings schema; any unknown/blank evidence ID is rejected and makes the stage partial. Aggregate findings are the deduplicated union of valid findings, with all failed requests retained. Common credential literals are redacted before provider/portable output without changing the frozen local source. The preflight used explicit test doubles only (zero API calls) and determined 367 planned batches across 114 packages, maximum 56 for one package. This is increased work, not 367 independent samples. A preliminary smaller-batch structural preflight is retained; no detector outcomes informed the final size.

## Fixed execution and stopping rule

- Model: `gpt-6-luna`; reasoning: `none`; temperature: `0`; retries: `0`.
- Alert threshold: medium or higher; OR combination across the three selected engines.
- Pinned Cisco: 2.2.2 with the same selected analyzers and policy.
- One scheduled revised pass over all 114 rows; two package workers as in the baseline. Chunk requests and aggregation follow only the frozen deterministic plan.
- No post-result prompt/rule tuning, selective rerun, error replacement, model substitution or stopping after good results.
- Save protocol/source hashes before calls; save each case before aggregate results. Preserve every first error and incomplete response.
- If transport, credentials or an implementation defect prevent completion, keep the attempt, label it incomplete/invalid as appropriate, and require a separately versioned protocol for any subsequent run. Do not merge best outcomes across attempts.
- After execution, verify corpus and source hashes again. A source change during the run invalidates a frozen-code claim.

## Scoring and mandatory comparison

Reuse the original eligibility contract: complete selected engines, complete preserved package and no coverage gap are required for classification. Missing files, incomplete source packages, unsupported formats, partial analysis, errors, missing engines and unknown ground truth do not become false negatives or true negatives. Alerts observed on incomplete cases can be reported, but do not turn them into evaluable true positives.

Report both cohorts separately for native, Cisco, semantic and combined:

1. Full population TP / FP / TN / FN, completed unknowns, exclusions by primary reason, coverage by true label and detected-positive floor TP / all positive labels.
2. Paired change on the identical rows eligible before and after, with exact case IDs. This is the direct before/after comparison.
3. Newly evaluable rows, lost evaluability, and their complete outcomes separately. A recall percentage with an expanded denominator is not the same estimand as baseline recall.
4. Every row transition, including TP → FN, TN → FP, incomplete → FN, and previously clean → incomplete. Keep old and new failure details in the original records.
5. Per-engine ablations on the common eligible intersection across all engines and both runs.
6. Request counts, source chunk coverage, token usage, duration and model metadata, including increased work from coverage expansion. Request counts are not skill sample size.

Do not collapse the two convenience cohorts into a headline whole-world accuracy, precision or F1 estimate: their class mix was selected by research availability and source labels have not been independently adjudicated. Descriptive counts and paired rates are valid within the stated sample; generalization and causal prevention remain unmeasured.

## Verification

The independent, dependency-free `compare.py` reads both artifacts and exact frozen manifests. It verifies complete case sets/order, sample/provenance equality, external labels, per-file hashes, inspected snapshot fingerprints, source-freeze consistency, selected engines, recorded metric recomputation and current fixture hashes. It writes portable identities, outcomes, counters and rule codes, not source excerpts, secrets, private paths or raw logs.

Its offline self-check covers known TP/FP/TN/FN/unknown/incomplete cases, preserving alerts on incomplete cases, paired eligibility, newly/lost evaluability, label tampering and snapshot tampering. Baseline self-comparison is a consistency test only; it is not a new detector evaluation or paid run.
