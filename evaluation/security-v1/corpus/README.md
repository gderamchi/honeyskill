# Security v1 external development corpus

**94 exact-byte cases: 80 externally labelled malicious and 14 unadjudicated upstream controls.** This is an external development corpus, not a blind holdout or a new accuracy result. No included skill was installed or executed during acquisition.

| Source | Cases | Basis |
| --- | ---: | --- |
| MaliciousAgentSkillsBench | 45 | One case per selected anonymized source repository; original study case annotations and package hashes retained |
| SkillLeakBench | 32 | One case per selected structural family in the consolidated public archive |
| Named vendor incident cases | 3 | Twitter Sum, poisoned Bybit skill, Google QX4; original incident-version caveats retained |
| Official upstream controls | 14 | Binance (5), Circle (7), Anthropic (2); labels remain `unknown` |

`manifest.json` is the index. Each case has a pinned source, source-label evidence, threat-type provenance, primary text hash, per-file hashes, completeness, license status and evaluation limits. `samples/` contains 474 non-executable `.fixture` files (4,958,972 bytes). There are no discoverable `SKILL.md` files. Relative paths in `files[].originalPath` preserve package relationships without restoring executable names.

57 cases preserve all regular files of the selected published snapshot, 34 omit binary/generated or unsupported file formats, and 3 retain only vendor-linked skill text. “Complete preserved snapshot” does **not** mean all original dependencies, attacker payloads or plugin-level resources are present. No remote payload was fetched. Unknown controls cannot become TN/FP merely because their publisher is legitimate.

Read [the corpus research note](../../../docs/research/security-v1-corpus.md) for source quality, blockchain examples and interpretation. The 81 grouping identifiers are repository, structural or mechanism groups, **not 81 independent campaigns**. Source groups and attack families require further adjudication for leakage-resistant future splits.

## Offline verification

```sh
python3 evaluation/security-v1/corpus/verify_corpus.py
```

The verifier checks every retained byte, file size, primary hash, non-executable mode, path containment, index completeness, source pointers and aggregate counts. This proves local consistency with the manifest, not the truth of external labels.

## Reacquisition

Run these from the repository root. They retrieve public pinned GitHub metadata and text only; embedded skill destinations are never followed. Rebuilding replaces the manifest, so run all steps in order when intentionally recreating this development corpus:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 evaluation/security-v1/corpus/fetch_sources.py
PYTHONDONTWRITEBYTECODE=1 python3 evaluation/security-v1/corpus/build_corpus.py --cache-dir evaluation/security-v1/corpus/.source-cache
PYTHONDONTWRITEBYTECODE=1 python3 evaluation/security-v1/corpus/acquire_controls.py
PYTHONDONTWRITEBYTECODE=1 python3 evaluation/security-v1/corpus/acquire_vendor_cases.py
python3 evaluation/security-v1/corpus/verify_corpus.py
```

Original third-party terms are retained; publication rights are **not** cleared by the research archive's metadata license. The files currently remain local, uncommitted and unpublished. Do not move fixtures into any skill discovery directory, remove `.fixture` suffixes, or execute included commands.
