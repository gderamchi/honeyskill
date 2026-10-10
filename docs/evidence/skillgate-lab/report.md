# SkillGate 0.5.0 — release validation

Source and compiled CLI: `41fca4d8ec9422eebe32043b4006cc95c91dac72` (tag `v0.5.0`). Tests are local executions, not a CI claim.

- Application tests: 127 passed. Behavioral tests: 74 passed, 1 optional live-chain test skipped. Typecheck, build, offline package install and package smoke passed.
- Three fresh public installations succeeded: GitHub shortcut, pinned v0.5.0 and compiled release asset. Their CLI bytes match the tested build. The first unpinned archive streamed slowly (~198 seconds); the pinned trial took 4 seconds and the release asset 1 second. A bounded 20-second trial failed on npm's SSH fallback; it is not counted as a successful installation.
- Actual public CLI: `skillgate try good` completed all stages in 39.5 seconds, installed automatically, zero recipient violations.
- Actual public CLI: `skillgate try trap` completed all stages in 39.9 seconds, held the skill, observed two unintended-recipient transfers. The report existed and the target was absent before choosing 2. Explicit interactive approval installed the exact snapshot with an exception; the MALICIOUS behavioral verdict remained.
- Earlier local runs included a completed benign installation, a held malicious skill with four violations, and one unverified attempt whose LLM quotation failed exact line validation despite a completed behavioral MALICIOUS audit. That failure remains in the evidence. Numbered model input corrected the citation issue without weakening validation.

All fixtures in these release checks are authored synthetic examples. These checks establish the installation flow, not real-world detection accuracy. Frozen benchmark corpora, prompts and historical results were preserved. The full LLM review is separate from the frozen text-only benchmark baseline.

Payments ran only on owned local Fuji forks with throwaway keys. The consistency validator verifies retained receipts/context and protocol boundaries; it is not independent network capture. API tokens are observed usage, not a billing statement. No raw workstation logs, credentials or user account data are published.

See [tests](tests.json), [public package verification](public-install.json), [actual run consistency checks](validation.json), and [pre-approval state](interactive-before-choice.json). Full private traces remain local.
