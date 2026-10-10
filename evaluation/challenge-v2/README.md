# Additional synthetic challenge

Sixteen new authored scenarios: eight labelled suspect and eight legitimate.
These are inert synthetic hypotheses, not original malware, real incidents or
real account instructions. They cover financial-risk categories FIN-01 through
FIN-06, paraphrases, related files, defensive quotations, active content beside
a defensive example, and openly requested financial operations.

This is a **same-team, non-independent** challenge. It is not a scientific blind
evaluation. Its author previously saw the old scanner during earlier work. The
author did not inspect the evolving new analysis implementation while writing
these cases. Exact cases and labels were withheld from the rule author until
the first execution of the new engine. Shared repository access does not provide
an independently enforced information barrier.

`freeze.json` fixes case bytes and labels before either baseline or new-engine
execution. No scenario will be edited to improve scores after a run. Keep all
misses, false positives and acquisition errors. Future tuning on disclosed cases
must be labelled as such and must not be called a new held-out evaluation.

All skill entry files use `SKILL.md.fixture`. The runner materializes them only
under a fresh temporary directory, invokes the selected real bundled CLI in
static mode, stores actual scan reports, and removes the temporary directory.
No acquired code, dependency, wallet, model or payment API is executed. It runs
scans only; “auto-install eligible” describes the verdict, not an installation.

```sh
python3 evaluation/challenge-v2/run.py --check-freeze
python3 evaluation/challenge-v2/run.py \
  --cli work/improvement-0.4.0/baseline/dist/cli.js \
  --output evaluation/challenge-v2/runs/baseline-0.3.1.json
python3 evaluation/challenge-v2/run.py \
  --cli dist/cli.js \
  --output evaluation/challenge-v2/runs/first-new-engine.json
```

The runner refuses to overwrite an earlier result. It checks the frozen bytes
before starting the selected CLI. The manifest and runner SHA-256, CLI version,
bundle SHA-256, rule versions, timestamps, decisions, coverage, excerpts and
failures are preserved in the result.

Raw run evidence remains local under `runs/`; its reports contain temporary
source paths. Public publication uses sanitized per-case summaries under
`docs/evidence/`, preserving decisions, findings, versions and fingerprints
without publishing those local paths. The raw results are not rewritten.

Metrics distinguish a financial finding from a retained package: an incomplete
scan may need review without detecting the expected financial behavior. Engine
errors are reported separately and do not count as successful detections. A
legitimate example with findings is a labelled false positive for this small
challenge, not proof that every such real-world workflow is safe. These rates
must not be generalized to arbitrary malicious skills or production traffic.
