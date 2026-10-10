# ADR 0005 — Frozen experiments and explicit provenance

Status: accepted; recorded retrospectively 2026-10-10 for version 0.5.0.

## Context and decision

The user asked whether behavioral analysis adds value over ordinary text review, then asked for subtle and real GitHub skills. Preserve original and realistic-v2 corpus bytes, labels, prompts and protocols. Run both methods freshly on the same inputs, score the shared complete subset, retain failures, report denominators/usage/elapsed time, and avoid ground truth derived from our own verdict.

Distinguish authored synthetic skills, documented third-party reports, mocks, ledger simulations and actual API/local-fork executions. Installation fixtures are separate from benchmark corpora. Never rewrite external payloads to manufacture a compatible positive or treat a general malware label as truth for recipient substitution.

## Consequences

The measured synthetic advantage is narrow and compute budgets differ. The five-skill external probe did not validate it: documented attacks relied on unsupported shell/download effects; external classification metrics are N/A. A future in-scope external benchmark requires independently documented compatible positives, pinned provenance and a fresh protocol.

Evidence: [comparison](../SKILLGUARD_COMPARISON.md), [realistic-v2](../SKILLGUARD_REALISTIC_V2.md), [external probe](../evidence/skillguard-lite/real-world/report.md).
