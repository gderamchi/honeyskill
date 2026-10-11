# ADR 0009: Persistent project integration for Codex

Date: 2026-10-11. Status: accepted for 0.6.0-dev.1.

The temporary `on` terminal and optional native hook did not provide the requested once-per-agent-repository setup. `setup` now configures the native Codex hook by default and pins the compiled installer locally, independently of global npm lifecycle changes. `enable` retains compatible shell output. Supported installation calls from Codex, including repository subdirectories, route through the saved static/hybrid policy before activation. Full behavioral installation remains lab-only.

Codex requires human review/trust of project hooks. HoneySkill reports configuration separately from actual trust and execution. The hook command verifies runtime bytes and converts bounded child failures into denial. Codex's own skip/timeout/failure behavior, manual filesystem writes and other agents remain outside the guarantee. An OS or mandatory agent-loader boundary is required before claiming every possible skill installation is enforced.

The integration smoke runs actual Codex with a deterministic local mock across independent sessions after one setup. This proves interception and persistence under the recorded host configuration; it does not measure model accuracy, real attacks or persisted human trust. Existing frozen benchmarks and release evidence are unchanged. See [setup and failure boundary](../PERSISTENT_CODEX_SETUP.md).
