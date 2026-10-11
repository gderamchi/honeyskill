# Architecture decision records

ADRs 0001–0006 were recorded retrospectively on 2026-10-10 for the 0.5.0 handoff; they do not claim separate ADR files existed when those choices were made. ADR 0007 records the subsequently authorized security development scope on 2026-10-11. Published release behavior and frozen evidence remain unchanged.

| ADR | Decision |
| --- | --- |
| [0001](0001-explicit-lab-pipeline.md) | Explicit trial command and dedicated lab; three analyses before activation |
| [0002](0002-openai-luna.md) | OpenAI GPT-6 Luna, reasoning none, minimal reference agent |
| [0003](0003-local-fuji-and-recipient-oracle.md) | Owned local Fuji fork, send-only execution and literal recipient oracle |
| [0004](0004-snapshot-coverage-and-exceptions.md) | Exact snapshot, separate risk/coverage, fail-closed activation and bounded exceptions |
| [0005](0005-frozen-benchmarks-and-provenance.md) | Frozen comparisons, source provenance, explicit synthetic/live distinctions |
| [0006](0006-cli-distribution-and-private-evidence.md) | Compiled CLI without install hooks; public summaries, private raw evidence |
| [0007](0007-research-based-security-development.md) | Separate experimental security lane: actual external scanner, bounded Progent port, financial mediation and independent evidence categories |

| [0008](0008-honeyskill-controlled-payment-demo.md) | HoneySkill branding, compatibility, isolated payment replay and honest submission claims |

Current development: [SECURITY_V1](../SECURITY_V1.md), [HANDOFF](../HANDOFF.md), [PROJECT_STATE](../PROJECT_STATE.md). Historical 0.5.0 workflow: [lab guide](../PREVIOUS_INSTALLATION_LAB.md).
