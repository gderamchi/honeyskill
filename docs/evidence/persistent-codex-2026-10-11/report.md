# Persistent Codex integration: local verification

Date: 2026-10-11. HoneySkill 0.6.0-dev.1. These are freshly executed local checks, not CI or model-accuracy results. [Machine-readable evidence](summary.json) · [Reproduction and boundaries](../../PERSISTENT_CODEX_SETUP.md).

| Test | Actual observation |
| --- | --- |
| One setup, later independent Codex sessions | One setup; three Codex CLI 0.154.0 processes used the saved hook without shell activation |
| Global npm lifecycle independence | Original CLI removed before all three sessions; pinned installer still worked |
| Authored clean fixture | Static decision allow; shell exit 0; exact fingerprint activated |
| Authored risky fixture | Static decision hold; shell exit 2; no risky activation |
| Pinned runtime corrupted before third session | Native denial; no shell command execution and no new scan |
| Original upstream installer | Never executed, verified by an executable sentinel |
| Setup repeated with identical bytes | Same pinned path; hook definition unchanged |
| Missing semantic key in hybrid profile | Incomplete coverage; no activation |
| Missing/changed runtime, crash, malformed output, missing Node, child timeout | Unit cases returned native denial |
| Application suite | 267 passed, 4 skipped, 0 failed (271 total) |
| Behavioral regression suite | 74 passed, 1 skipped, 0 failed (75 total) |
| Typecheck / compiled build / archive / installed-package smoke | Passed; 14 recorded package commands and 7 protected terminal cases; zero network attempts |

The provider was a deterministic Responses SSE mock on loopback, supplying prescribed tool calls to actual Codex. Six local mock requests, zero paid provider calls, zero real credentials, zero real funds. This establishes installation routing and persistence under the recorded host setup. It does not establish LLM behavior, unseen-malware accuracy or full behavioral-pipeline integration. The operational corruption test is not a TP/TN malware example.

Hook trust was bypassed explicitly for each isolated smoke invocation, with a temporary HOME/CODEX_HOME and an isolated test sandbox. Persisted human `/hooks` trust was not tested or forged. Production use requires the user to trust the project hook once. Codex can skip untrusted/disabled hooks or fail open before the guard runs; manual file writes and other agents are not covered. Full `try` activation remains lab-only. Frozen benchmark outputs and previous release assets remain unchanged.

Raw logs are intentionally private and are not included here. The JSON contains only allowlisted public fixture findings, hashes and outcomes. Hashes support integrity/recomputation; they are not independent third-party attestation.

## Public distribution follow-up

Fresh public release-archive and Git-tag installations passed with new npm prefixes and caches. Installed CLI hashes match the locally verified runtime. The downloaded archive is byte-identical to the packed archive; its installed-package smoke passed again. An initial Git-install harness configuration error (duplicate empty npm config paths) failed before installation and was corrected without a product change. See [sanitized distribution receipt](public-install.json). This evidence-only follow-up does not alter the tag or package. POSIX integration was tested on macOS; Windows was not verified.
