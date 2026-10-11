> Historical architecture: the static/optional-semantic installation product. The current full lab pipeline is documented in [HANDOFF.md](HANDOFF.md), [PREVIOUS_INSTALLATION_LAB.md](PREVIOUS_INSTALLATION_LAB.md), and the [ADR index](adr/README.md). Do not infer current execution coverage or activation policy from this older architecture.

# Architecture

SkillGate checks financial-agent skills before installation. It does not control transactions after activation.

The shared pipeline is: acquire without executing code → inventory and fingerprint → financial rules → optional explicitly configured semantic analysis → deterministic policy → verified snapshot activation.

## Components

- `packages/contracts`: validated reports, findings, coverage, installation records and sources.
- `packages/core`: acquisition, FIN-01…06 checks, policy, optional provider and local persistence.
- `apps/cli`: English commands, terminal/HTML reports, PATH wrappers and optional Codex hook.
- `apps/web` and `server.ts`: historical UI code, excluded from the shipped CLI.
- `packages/demo`: a deterministic fictional ledger, without a live model or real financial operations.
- `evaluation`: frozen synthetic cases, labels outside scanned packages, runners and measured results.

## Installation boundary

`skillgate on` starts Bash without startup files and places wrappers for supported `npx`, `pnpm` and `skills` commands first on PATH. They route installation through the scanner before the upstream installer executes. `exit` returns to the parent shell. Global profiles and user history are not modified.

This covers supported commands in the activated project/session and descendants inheriting its environment. Absolute binaries, manual copies, arbitrary installers and other sessions remain outside the boundary. The optional Codex hook adds rewriting subject to native trust review and host permissions; it is not a security sandbox.

## Untrusted bytes

Skill scripts, hooks and dependency installers are never executed. Remote references found inside skills are not fetched. Collected files enter private quarantine outside the agent's discovery directory.

GitHub acquisition in 0.4.0 resolves a public revision using Git and downloads its immutable codeload archive. It uses neither the GitHub REST API nor a token. Resolution, download and parsing are bounded. Invalid paths, links, special files, malformed archives and exceeded limits fail closed. The selected skill is inventoried with the same policy as a local source.

The canonical manifest contains sorted relative paths, sizes, SHA-256 values and executable flags. Before activation, SkillGate inventories the quarantined bytes again and verifies the prepared snapshot. The active directory is a symlink created by SkillGate to that snapshot. Updates replace the pointer atomically only after verification.

## Detection and policy

The default engine uses local text heuristics and evidence correlation. Matching may normalize concealed characters while evidence retains the original source text. Negated and explicitly rejected examples need local context; an educational label cannot exempt the entire package.

Risk and coverage remain separate. A complete supported scan with no financial findings may auto-install. Findings or incomplete analysis require review; high/critical supported findings hold the package. Failed acquisition never activates it. Truncated packages cannot be activated through an exception.

An exception binds one report, fingerprint and destination to the operator's recorded choice. It does not authorize future versions. Changes to rules, engine or profile invalidate old reports for activation. A semantic provider cannot remove native findings or grant installation authority.

## Local state and distribution

Configuration, quarantine, reports, snapshots, installation records, locks and recovery transactions live in `.skillgate/`. JSON writes use temporary files and rename; activation locks the affected skill. There is no telemetry or remote database. The OS account owner can alter this state.

The public repository commits the compiled CLI and data with no install/build lifecycle hook, enabling `npm i -g gderamchi/skillgate`. Summaries in `docs/evidence/` distinguish actual tests/acquisition/installations, synthetic detection measurements and simulated model/ledger work. Raw workstation logs stay local.
