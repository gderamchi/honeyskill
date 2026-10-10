# Architecture decision records

Recorded 2026-10-10 for handoff. These accepted decisions are **retrospective records** of user constraints and the 0.5.0 implementation, not a claim that separate ADR documents existed when the choices were made. They add no scope or authorization. A later change should explicitly supersede the relevant record and preserve historical evidence.

| ADR | Decision |
| --- | --- |
| [0001](0001-explicit-lab-pipeline.md) | Explicit trial command and dedicated lab; three analyses before activation |
| [0002](0002-openai-luna.md) | OpenAI GPT-6 Luna, reasoning none, minimal reference agent |
| [0003](0003-local-fuji-and-recipient-oracle.md) | Owned local Fuji fork, send-only execution and literal recipient oracle |
| [0004](0004-snapshot-coverage-and-exceptions.md) | Exact snapshot, separate risk/coverage, fail-closed activation and bounded exceptions |
| [0005](0005-frozen-benchmarks-and-provenance.md) | Frozen comparisons, source provenance, explicit synthetic/live distinctions |
| [0006](0006-cli-distribution-and-private-evidence.md) | Compiled CLI without install hooks; public summaries, private raw evidence |

Current implementation/status: [HANDOFF](../HANDOFF.md), [PROJECT_STATE](../PROJECT_STATE.md), [lab guide](../SKILLGATE_LAB.md).
