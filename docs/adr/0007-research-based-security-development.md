# ADR 0007 — Separate research-based security development and evidence lanes

Status: accepted and implemented in local `0.6.0-dev.0`; offline/package/local-chain validation and first live development evaluation recorded 2026-10-11. Independent-holdout and causal runtime-prevention evaluation remain outstanding. This scope does not change published 0.5.0 or rewrite ADRs 0001–0006 and their frozen evidence.

## Context

The user requested reviewable benchmarks, documented real malicious packages, established prompt-injection defenses and blockchain checks. The prior six-task AVAX experiment neither executed arbitrary skill scripts nor established broad real-world malware detection or prevention. More synthetic scenarios alone cannot resolve that gap.

## Decision

Create a separate experimental `security` command family and `security-v1` corpus. Integrate the actual pinned Cisco Skill Scanner 2.2.2, retain the financial LLM review, and port the static JSON-Schema subset of Progent's reference checker. Extend that tool boundary with exact financial capabilities, integer budgets, fee/approval/swap constraints, secret denial, replay limits and evidence records. Trusted host code owns policy; a skill or model cannot authorize itself.

Separate **labelled-package detection, proposed-action authorization and observed effects**. Static AST/dataflow findings are not runtime traces. Instrumented callbacks are not on-chain effects. The guarded-model exercise exposes only mediated typed actions and simulated effects. A separate implemented `chain-proof` adapter executes native payments on its own ephemeral Anvil genesis, with a fresh in-memory signer and receipt/state checks; it accepts no public transaction RPC or user key. Acquired scripts/dependencies are never executed.

Import pinned inert artifacts with hashes, source labels and completeness. Keep source/vendor malicious labels, unknown official controls and constructed benign research controls in separate strata. Do not infer negative ground truth from clean scans or reputation. Preserve source bytes and disclose label-bearing controls. The imported corpus is development data; independent validation requires blinded human labels, authorized tasks, source/family separation and a frozen protocol.

## Consequences

This adds an external maintained engine and bounded research replication without claiming a universal prompt-injection solution. It does not reproduce all of Progent or CaMeL's interpreter. Correct trusted policies, complete mediation and correct effect adapters remain necessary assumptions.

Reports retain every case, origin, findings, coverage and engine result. Only complete supported independently labelled rows enter the relevant confusion matrix. Unknown, partial, failed and unsupported outcomes stay separate. Detection, utility, authorization and effects have separate denominators. Historical release checks are not new tests or CI.

Actual local-chain validation recorded five synthetic proposed actions and 16 passing assertions; this establishes bounded integration, not real-skill effectiveness. A subsequently authorized live batch used masked key entry without persistence: 99 inspection responses and 12 responses across six guarded synthetic cases. All six exact payments completed, with zero unauthorized proposals and therefore zero observed interceptions. See the [dated live report](../evidence/security-v1/live-2026-10-11/report.md). Earlier access does not authorize credential recovery. Corpus redistribution rights remain unresolved; this step does not publish it.

The [final offline evidence](../evidence/security-v1/report.md) exposes low conditional external recall (7/32) and high false alerts on constructed controls (7/19), with explicit coverage losses. Local implementation tests and reference-checker parity do not override those findings. The decision delivers auditable mechanisms and evidence boundaries, not a claim of general detector effectiveness. CI was not run and no new release was published.

References: [runbook/protocol](../SECURITY_V1.md), [engine research](../research/security-v1-research.md), [Progent replication](../research/security-v1-progent.md), [financial policy](../research/security-v1-policy.md), [external corpus](../research/security-v1-corpus.md), [constructed negatives](../../evaluation/security-v1/negative-corpus/README.md).
