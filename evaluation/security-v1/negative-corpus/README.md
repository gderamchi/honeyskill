# External constructed negative controls

This separate cohort contains **20 author-labelled benign AgentTrap utility cases**, with **142 exact inert files**, **18 source-skill families**, and **20 distinct primary text hashes**. It provides a bounded check for overblocking. It does **not** establish the false-positive rate on real deployed skills.

The existing 94-case corpus in `../corpus/` remains unchanged. Its 14 official-source controls remain `unknown`; none has been promoted to benign.

## Ground truth and evidence

[AgentTrap section 4](https://arxiv.org/html/2605.13940v1) describes its construction of benign utility cases. Each selected row in the [pinned case registry](https://github.com/zhmzm/AgentTrap/blob/613c37512d16a92731d6f145f67f735f1ced9d20/cases/cases.json) has `is_benign: true`, a user trigger, a pass condition, and a failure condition. The source labels predate SkillGate's evaluation and do not depend on its predictions.

These labels mean **the externally authored case is intended to perform the published authorized utility task**. They do not mean that an independent reviewer has proven every behavior safe in every environment. Deletion, S3 backup, secret management, and broad database permissions can be legitimate under the published task; authorization is part of the label. The manifest retains the exact task conditions, source record pointer, and a copy of each selected record in `case-records.json`.

AgentTrap's source runtime judging uses a separate evaluation method; no source runtime result was reproduced during acquisition. No fixture helper, shell command, skill, or dependency was executed or installed.

## Selection and fidelity

The importer iterates externally labelled benign cases in ascending numeric ID. It requires a complete preserved skill directory and unique primary `SKILL.md` bytes, then stops at 20. It does not run SkillGate or select according to detector success.

- Cases 102 and 108 are excluded for duplicate primary bytes.
- Cases 110 and 111 are excluded in full because their XML companion files fall outside this importer's conservative text-file allowlist. This is an acquisition limitation, not evidence of a threat.
- Cases 101, 103–107, 109, 112–115 and 6101–6109 are retained.
- Every retained case includes all Git blobs in its pinned skill directory. External task workspaces, system dependencies and remote services are outside this definition of package completeness.

All file bytes match the pinned public revision `613c37512d16a92731d6f145f67f735f1ced9d20` (commit date 2026-06-22). The importer verifies Git blob hashes before retaining a file, records SHA-256 and byte length, adds only `.fixture` to the filename, and removes executable permissions. No retained content is rewritten or sanitized. Suspicious secret patterns would exclude the entire case, not silently alter it.

Several primary texts declare MIT or retain upstream notices. A repository-wide license was not located at the pinned revision. Per-file rights are not fully established; this local research corpus is **not cleared for redistribution**.

## How to report results

Keep `provenanceKind: research-control` separate from `real-malware` and `upstream-control` metrics. For a supported static analysis of these author-intended negatives, an attack prediction is an FP under the case's bounded source label; a clean prediction is a TN. Errors, incomplete inspection and unsupported behavior are separate outcomes, not TNs. The AVAX `send` behavioral harness does not become compatible with these tasks merely because their packages were acquired completely.

Nine v5 packages (6101–6109) explicitly call themselves benign fixtures and include label-bearing `source_meta.json`. Their wording and helper code are also highly repetitive. These source cues are preserved for exact-byte fidelity and explicitly listed in each manifest entry. A model can exploit them: this cohort is an **overblocking smoke test, not a blinded classifier benchmark**. Report v3 and v5 results separately when possible. Combining their counts with real malicious packages into a single headline accuracy would hide this asymmetry.

`unseenToModel` is `unknown`; acquisition during this project is not evidence that the model has never seen a public case. This is development data, not a sealed holdout. No measured FP/TN result is claimed by this acquisition artifact itself.

## Remaining real-negative evidence gap

A bounded search found a stronger *method* but not usable public per-case assets: [Semia section 7.1.1](https://arxiv.org/html/2605.00314v1) describes two authors independently reviewing raw skills while blinded to the detector, resolving disagreements, and producing 301 risky / 240 clean labels. The inspected [public Semia tree](https://github.com/berabuddies/Semia/tree/379bc25fe99833eb185efe56a38fe15f0235799c) did not expose a matching released case-label dataset. This is a search limitation, not a claim that no release exists anywhere.

[SkillTrustBench](https://huggingface.co/datasets/cuhk-zhuque/SkillTrustBench/blob/main/README.md) and [ATR's skill benchmark](https://huggingface.co/datasets/Agent-Threat-Rule/atr-skill-benchmark) offer negative pools, but the bounded inspection did not establish a public, per-case independent human-adjudication protocol adequate to upgrade those labels here. Source reputation or an unflagged scan alone is insufficient.

The next defensible real-world FPR study needs exact public legitimate packages, a declared task/threat model, two reviewers blinded to SkillGate predictions, recorded rationales and disagreements, and a held-out split frozen before tuning. This external constructed cohort supplements that work; it does not replace it.

## Reproducibility

Run `python3 evaluation/security-v1/negative-corpus/verify.py` for offline integrity checks. `validation.json` records the latest check. Acquisition is available in `acquire.py`, is pinned to public GitHub, refuses to overwrite a manifest, and requires the existing 94-case manifest hash to remain unchanged. Reacquire in a disposable copy if needed; do not load `.fixture` files as instructions.
