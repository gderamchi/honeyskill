# SkillGate development repair: before / after

This is a tuned development-corpus rerun, not a blinded holdout or independent replication. Source labels are preserved; unknown cases are never counted as benign. Unsupported and incomplete cases stay outside TP/FP/TN/FN.

| Cohort | Engine | Run | TP | FN | FP | TN | Incomplete | Completed unknown |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| external | native | Before | 4 | 34 | 0 | 0 | 43 | 13 |
| external | native | After | 6 | 34 | 0 | 0 | 41 | 13 |
| external | cisco | Before | 7 | 25 | 0 | 0 | 49 | 13 |
| external | cisco | After | 10 | 25 | 0 | 0 | 46 | 13 |
| external | semantic | Before | 5 | 32 | 0 | 0 | 45 | 12 |
| external | semantic | After | 19 | 17 | 0 | 0 | 45 | 13 |
| external | combined | Before | 10 | 22 | 0 | 0 | 50 | 12 |
| external | combined | After | 18 | 14 | 0 | 0 | 49 | 13 |

## external: identical eligible rows

30 labelled rows are eligible in both runs. Combined before: TP 9, FN 21, FP 0, TN 0. After: TP 16, FN 14, FP 0, TN 0.
Newly evaluable: 2. Lost evaluability: 2. These do not enter the paired change estimate.

| Transition | Cases |
| --- | ---: |
| FN -> FN | 12 |
| FN -> INCOMPLETE:partial | 1 |
| FN -> TP | 9 |
| INCOMPLETE:coverageGap -> INCOMPLETE:coverageGap | 1 |
| INCOMPLETE:partial -> INCOMPLETE:partial | 11 |
| INCOMPLETE:partial -> INCOMPLETE:partialPackage | 3 |
| INCOMPLETE:partialPackage -> INCOMPLETE:partial | 1 |
| INCOMPLETE:partialPackage -> INCOMPLETE:partialPackage | 23 |
| INCOMPLETE:unsupported -> INCOMPLETE:partial | 2 |
| INCOMPLETE:unsupported -> INCOMPLETE:partialPackage | 6 |
| INCOMPLETE:unsupported -> TP | 2 |
| INCOMPLETE:unsupported -> UNKNOWN | 1 |
| TP -> FN | 2 |
| TP -> INCOMPLETE:partial | 1 |
| TP -> TP | 7 |
| UNKNOWN -> UNKNOWN | 12 |
| controls | native | Before | 0 | 0 | 3 | 16 | 1 | 0 |
| controls | native | After | 0 | 0 | 3 | 17 | 0 | 0 |
| controls | cisco | Before | 0 | 0 | 4 | 15 | 1 | 0 |
| controls | cisco | After | 0 | 0 | 5 | 15 | 0 | 0 |
| controls | semantic | Before | 0 | 0 | 0 | 16 | 4 | 0 |
| controls | semantic | After | 0 | 0 | 2 | 17 | 1 | 0 |
| controls | combined | Before | 0 | 0 | 4 | 12 | 4 | 0 |
| controls | combined | After | 0 | 0 | 7 | 12 | 1 | 0 |

## controls: identical eligible rows

16 labelled rows are eligible in both runs. Combined before: TP 0, FN 0, FP 4, TN 12. After: TP 0, FN 0, FP 4, TN 12.
Newly evaluable: 3. Lost evaluability: 0. These do not enter the paired change estimate.

| Transition | Cases |
| --- | ---: |
| FP -> FP | 4 |
| INCOMPLETE:unsupported -> FP | 3 |
| INCOMPLETE:unsupported -> INCOMPLETE:partial | 1 |
| TN -> TN | 12 |

## Evidence boundary

The JSON lists every case transition for every engine, paired row IDs, newly evaluable rows, all primary exclusions and all stage error counts. Complete source hashes and the original baseline artifacts are retained. This check verifies internal consistency and unchanged bytes; it does not establish ground-truth correctness, an untouched test set, or runtime prevention.

An unchanged result after tuning is retained as a failure. A risk alert on an incomplete case remains an incomplete case. Source-label disputes do not modify labels. Model request counts may rise when coverage expands; differences in work performed are disclosed in the frozen repair protocol.
