# Security laboratory v1: research and dependency choices

Research checked on 2026-10-11. This document records implementation choices, not a new accuracy claim for HoneySkill. The frozen SkillGuard-Lite protocols and historical results remain unchanged.

## Selected implementation

Use Cisco Skill Scanner as a separately named package-analysis engine. Keep the LLM review, task-contract evaluator, behavioral execution and final coverage/decision policy independent. Cisco's `behavioral_analyzer` performs **static Python AST/dataflow analysis**; it is not a record of executing the inspected skill.

The adapter in `packages/security-lab/src/cisco.ts` runs an explicitly supplied, absolute `skill-scanner` executable on the already quarantined snapshot. It requests the default static, bytecode, pipeline and correlation analyzers plus the behavioral analyzer. It enables no LLM, meta-review, reputation service, dependency-network lookup or optional community rule pack. CEL runs in shadow mode. The subprocess has bounded time/output, no shell, a neutral temporary working directory and an environment allowlist without credentials, provider flags, user `PATH`, `PYTHONPATH` or dotenv loading. This configuration is not an operating-system network sandbox.

The wrapper checks the exact scanner version, reported snapshot path, required analyzers, failures, rule-contract metadata, CEL incompleteness/suppression, coverage findings even at INFO, source paths and exact quotations. A snapshot digest before/after the process detects changed bytes. Symlinks, special files, `.git`, deep/oversized trees are unsupported by this adapter. Existing findings survive incomplete analysis; the wrapper never treats upstream `is_safe` as an installation authorization.

A `complete` Cisco result means this bounded invocation returned all required engine evidence. It does not establish that every attack surface was inspected or that the package is safe. Upstream JSON lacks a comprehensive per-file/per-language completeness ledger; the overall HoneySkill coverage layer must still identify missing resources and execution capabilities.

The first real CLI smoke revealed a YARA location expressed relative to the Markdown body: its exact quotation was on package line 6 while upstream reported line 2. The adapter preserves `upstreamLineNumber` and re-anchors only a unique exact quotation, marking it `relocated`. Missing, ambiguous or fabricated quotations cannot become verified citations.

## Pinned upstream artifact

- Package: `cisco-ai-skill-scanner==2.2.2`, Apache-2.0.
- Release: 2026-10-09; source commit `ef5cfee8d15fe207e09d808ccb5be4b9ae6d321a`.
- Annotated tag object: `477117bcbef54ccd788f9b95d00e42540f4a8615`.
- Verified local wheel: `cisco_ai_skill_scanner-2.2.2-cp311.cp312.cp313.cp314-none-macosx_13_0_arm64.whl`.
- Wheel SHA-256: `ba6b9b5992fe51d2f041ac1d7edf0542abfe4d3b80641b9d9f7235ab7622fa67`.
- Source-distribution SHA-256: `ae1b1e69beed7ba2ae7132022840b11c55bcb4d851fa0659bd4d3a591f830a8a`.
- All 221 scanner package/dist-info files checked against the downloaded wheel matched (excluding the installation-mutated `RECORD`). The compact JSON installed-file manifest SHA-256 was `01fd7f1262f5f84092f7d69b8ea419311e8baf901f241552998100d7d365f381` (preserved array order, no whitespace or trailing newline). The pretty-printed manifest file has a separate file digest recorded in runtime provenance.

The isolated development environment is under the original workspace's `work/security-tools/`, never installed globally. Private reproduction artifacts there include `cisco-provenance.json`, `cisco-installed-manifest.json`, `requirements-installed.lock`, the downloaded wheel and sanitized CLI smoke evidence. The lock records exact installed dependency versions; it is not a hash-locked reproduction of all transitive distribution artifacts. The product does not silently install Python tools or embed a workstation path.

Sources: [official release](https://github.com/cisco-ai-defense/skill-scanner/releases/tag/2.2.2), [package metadata/checksums](https://pypi.org/pypi/cisco-ai-skill-scanner/2.2.2/json), [license](https://github.com/cisco-ai-defense/skill-scanner/blob/2.2.2/LICENSE), [CLI and analyzer documentation](https://github.com/cisco-ai-defense/skill-scanner).

## Research foundations and limits

The [primary-source ledger](security-v1-source-ledger.md) also records the implemented Progent subset, FIDES as an extension candidate, and stronger adaptive-evaluation references. These references do not substitute for local measurements.

| Source | Mechanism reused or informing the design | What it does not establish here |
| --- | --- | --- |
| [AgentDojo, NeurIPS 2024](https://arxiv.org/abs/2406.13352) | Stateful environments, deterministic task/security checks, separate legitimate utility and attacker success; extensible adaptive attacks | Its constructed scenarios are not an unchanged real-skill corpus. HoneySkill does not claim to reproduce AgentDojo results. |
| [CaMeL, version 2, 2025](https://arxiv.org/html/2503.18813v2) | Keep trusted policies/control flow separate from untrusted values; enforce capabilities at tool boundaries | A task contract is not the CaMeL interpreter. Policies, complete mediation and implementation correctness remain assumptions. The paper discusses side channels and future formal verification. |
| [CaMeL reference code](https://github.com/google-research/camel-prompt-injection) | Inspectable research implementation | Upstream explicitly warns that the interpreter can contain bugs and is not supported as a product. No direct runtime dependency selected. |
| [NVIDIA SkillSpector v2.12.0](https://github.com/NVIDIA/SkillSpector/releases/tag/v2.12.0) | Alternative Apache-2.0 scanner and explicit completeness reporting | A possible independent baseline, not a second required engine in this implementation. Its Python/LangGraph stack duplicates substantial functionality. |
| [MaliciousSkillBench](https://github.com/ProtectSkills/MaliciousSkillBench) | Frozen hashes, provenance, structural families, source-disjoint splits and package manifests | Observed, constructed/injected and unresolved provenance must remain separate. Held-out source does not guarantee model-training novelty. Third-party artifacts retain upstream terms. |
| [Are Firewalls All You Need, or Stronger Benchmarks?, 2025](https://arxiv.org/abs/2510.05244) | Audit evaluators and attack strength; measure legitimate utility as well as attack success | High benchmark scores alone do not imply universal prompt-injection resistance. The authors themselves demonstrate bypasses and benchmark defects. |

Cisco publishes corpus-, model- and threshold-specific results, including low recall for rules alone, substantial LLM gains, false positives, incomplete-analysis failure modes and loss of recall from meta-review. These observations motivate retaining LLM modularity and independent fail-closed coverage, not importing any upstream accuracy number as a HoneySkill measurement. See [upstream measured results](https://github.com/cisco-ai-defense/skill-scanner/blob/main/docs/reference/measured-results.md). Current upstream documentation may evolve after this research date.

## What was verified for this adapter

Trust-boundary tests use explicitly mocked upstream JSON/processes for missing engines, malformed output, version mismatch, paths/symlinks, fabricated/ambiguous quotations, INFO coverage failures, environment isolation, timeouts, nonzero exits and snapshot mutation. The opt-in real CLI smoke reads an inert synthetic fixture and verifies that its helper's marker file was never created. This proves an integration path and static detections on that fixture; it is not an external accuracy benchmark or malware execution result.

Before any accuracy claim, freeze the implementation and scoring policy, preserve unsupported/error abstentions, use independently justified labels, report both classes and provenance strata, and evaluate unseen packages under compatible task environments. Replaying recorded evidence makes scoring repeatable; it does not make fresh LLM decisions deterministic.
