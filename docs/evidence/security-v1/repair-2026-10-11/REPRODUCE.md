# Rechecking this result

`verify-comparison.py` is the unchanged, frozen dependency-free comparator used for this run. With the preserved original run directories and exact repository fixtures available locally:

```sh
python3 verify-comparison.py --before BEFORE_RUN --after AFTER_RUN --repository CHECKOUT --out NEW_AUDIT_DIRECTORY
```

It requires the complete private `benchmark.json` records and fixture manifests, not just this portable projection. The portable `comparison.json` recomputes all matrices, eligibility intersections and transitions. `case-results.json` retains exact original per-case hashes and before/after fingerprints; `request-ledger.json` retains every batch status, input hash, token count and hashed response identity. `protocol.json` records the pre-run source freeze. None of these hashes is independent execution attestation.

Original runs: `live-2026-10-11T03-31-31-569Z` and `repair-2026-10-11T04-01-17-825Z`. Both remain separate; no failed attempt was overwritten. No raw hostile package contents, credentials, workstation logs or absolute workstation paths are redistributed here.

The protocol was frozen before the revised paid pass, after development fixes informed by the previous errors. An independent, source/family-disjoint holdout has not been run.

Browser validation: `final-report-ui-validation.json` records 50 checks on the three portable pages; its nine screenshots are included. `product-report-ui-validation.json` records 68 checks on the frozen product renderer; those private source-derived pages/screenshots remain in the audit work directory. Neither browser audit makes model calls or validates malicious intent.
