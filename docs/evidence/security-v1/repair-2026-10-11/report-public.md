> Public derived view: all counts retained. Original qualitative excerpts and raw corpus are not redistributed. See availability.html. Original source artifacts and their historical hashes are kept separately.

# SkillGate repair evaluation — 2026-10-11

The inspection pipeline improved on the existing development corpus, with material failures preserved. This is not an unseen holdout or a general security validation. Published 0.5.0 is unchanged.

| Outcome | Before | After |
| --- | ---: | ---: |
| Malicious labels: TP | 10 | 18 |
| Malicious labels: FN | 22 | 14 |
| Malicious labels: incomplete | 48 | 48 |
| Constructed benign controls: FP | 4 | 7 |
| Constructed benign controls: TN | 12 | 12 |
| Constructed benign controls: incomplete | 4 | 1 |
| Unknown labels: complete | 12 | 13 |
| Unknown labels: incomplete | 2 | 1 |

Original 22 FN: **9 TP, 12 FN, 1 incomplete** after revision. The excluded case retains a valid alert plus a failed model citation; it is not counted as a TP. Original 48 incomplete-positive transitions: `{'INCOMPLETE:partial': 13, 'TP': 2, 'INCOMPLETE:partialPackage': 32, 'INCOMPLETE:coverageGap': 1}`.

See [overview](index-public.html), [all 114 transitions](cases-public.html), [failure diagnosis](availability.html), [independent paired comparison](comparison.md) and [machine-readable comparison](comparison.json).

## What changed and what is still wrong

The separate security-semantic-2 module expands financial review to instruction manipulation, secrets/exfiltration and unsafe code. Deterministic batches cover every supported readable line instead of refusing a whole package over 64 KiB. Host-generated source IDs bind findings to exact evidence locations. Safe UTF-8 format coverage and exactly validated Cisco coordinate/redaction mappings were added. Legacy financial review and SkillGuard-Lite remain unchanged.

36 of the original 48 incomplete-positive packages lack source files. No files were invented/downloaded to improve coverage. Invalid source IDs, ambiguous Cisco locations, loader failures and unsupported bytes remain incomplete. Exact source IDs cannot ensure correct reasoning: the qualitative audit found one irrelevant but valid citation, one speculative alert, probable role-restriction overblocking, and the still-missed explicit sandbox/approval bypass in codex-chat. A benchmark TP can therefore still contain an incorrect alert explanation.

## Fair comparison and cost

All 114 rows were rerun once with unchanged bytes/labels/threshold and no selective retry. The paired comparison separately reports common eligible rows, newly evaluable rows and lost coverage. Both scope and work changed, so no single-fix causal attribution is justified. The original failures informed the repairs; this is development measurement, not independent generalization evidence. External labels remain unadjudicated. Nine constructed negative controls contain benign cues.

Inspection responses: 99 → 367; returned total tokens: 763,850 → 8,309,767. The revised deterministic plan schedules 367 requests across 114 packages, not 367 independent samples. The baseline's separate 12 guarded-model responses are excluded. No new runtime-prevention or chain benchmark was run.

## Verification

Protocol and 29 source/dependency/runner files frozen before API calls; no frozen source changes. Independent comparator checks both corpus manifests, all rows/labels/snapshot hashes, fixture bytes, metrics, per-engine ablations, first incomplete outcomes and request usage. Source reconstruction checks coverage; qualitative review separately checks alert relevance. Original detailed records remain private; portable hashes and structural evidence are supplied. Local consistency is not third-party attestation.

Local validation: 264 application tests passed / 2 skipped; 74 preserved behavioral tests passed / 1 skipped; final targeted 25 passed, Cisco targeted 17 passed including actual scanner. Final typecheck, CLI build, pack and offline package smoke passed. The final batch-size/schema adjustments were covered by targeted tests after the full application suite. CI was not run; no new release was published.

[Frozen protocol](protocol.md) · [source freeze](protocol.json) · [run completion](run-summary.json) · [portable case identities](case-results.json) · [artifact hashes](SHA256SUMS.json).

## Regressions and workload, explicitly

Only 30 positive rows are eligible in both runs: TP 9 / FN 21 → TP 16 / FN 14 (30.0% → 53.3% conditional recall). Two previously incomplete cases become TP; two previously eligible cases become incomplete. Positive coverage remains 32/80. The original 48 incomplete positives produce two TP and 46 still incomplete, while two newly incomplete positives restore the overall count to 48.

Old TPs jetaasc-newsletter and weekly-plan become FN; browser-automation becomes partial. These regressions remain scored against unchanged labels. The paired 16 negative controls remain FP 4 / TN 12; the three newly eligible negatives are all FP with pre-existing static alerts. Their appearance is restored eligibility, not evidence of newly created static alerts or improved specificity.

Seven of 367 batches have invalid source IDs; six semantic stages are partial. All first errors are retained in the [portable request ledger](request-ledger.json). Returned token usage grows 10.88×. Deterministic source reconstruction verifies 163,820 privacy-redacted source fragments, 367 planned request hashes and 545 host-derived semantic citations. Location validity does not establish reasoning validity. Redaction can obscure encoded/inline attack context, and chunk boundaries can break cross-file relationships.

Semantic alone on the same 16 controls worsens from FP 0 to FP 1, overlapping Cisco so the combined count remains 4. Three newly eligible controls include existing native false alerts; 0115 additionally gains two semantic findings, one asserting an insufficiently supported SQL bypass. See [regression audit](regression-analysis.json).
