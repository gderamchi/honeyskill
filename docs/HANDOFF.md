# SkillGate — start here when resuming

Updated 2026-10-10 after release 0.5.0. This is the portable handoff, not an instruction to expand the product scope. The user's next request and applicable AGENTS.md instructions take precedence.

## Read in this order

1. [Root instructions](../AGENTS.md), then [behavioral package instructions](../packages/skillguard-lite/AGENTS.md) when working there.
2. [Current project state](PROJECT_STATE.md): delivered work, validation, limitations and remaining decisions.
3. [Lab guide](SKILLGATE_LAB.md): the current user workflow and policy.
4. [Architecture decisions](adr/README.md): six accepted decisions recorded retrospectively from the implementation and user constraints.
5. [Release evidence](evidence/skillgate-lab/report.md). Read the linked JSON before repeating a measured claim.
6. Only for benchmark work: [comparison protocol](SKILLGUARD_COMPARISON.md), [realistic-v2 protocol](SKILLGUARD_REALISTIC_V2.md) and [external coverage probe](evidence/skillguard-lite/real-world/report.md).

## Current objective and stopping point

The requested five-part laboratory delivery is complete: dedicated test environment, single trial command, all three analyses, unified pre-activation report, and tested install/hold/exception behavior. No implementation step from that request is knowingly left pending. Do not restart the old web platform, replace the wallet, broaden transaction controls or repeat paid benchmarks merely to recover context.

Current command: `skillgate try <source>` runs regex/static rules, a GPT-6 Luna financial review and the SkillGuard-Lite behavioral audit on one quarantined snapshot. Reports precede activation. Activation is confined to the marked lab, not a real agent profile. Complete risky reports can be explicitly overridden; incomplete analysis, missing coverage, changed bytes and mocked behavioral evidence cannot authorize activation.

## Locate the actual checkout

Run `pwd`, `git rev-parse --show-toplevel` and `git status --short` before edits. In a normal clone, work directly in that repository. In the original projectless workspace, the working source directory is not itself a Git repository; its publication checkout is `work/product-publication`. That layout is local workflow history, not a requirement for a new clone. Do not create a nested repository or overwrite unrelated changes to make the layout match.

Public repository: [gderamchi/skillgate](https://github.com/gderamchi/skillgate). Release `v0.5.0` points to product commit `41fca4d8ec9422eebe32043b4006cc95c91dac72`. The subsequent evidence-only commit is `c26762ac71038bb43e1fdd4bd9c672cbf3e5a3b0`. Later handoff documentation does not change the released runtime. Recheck the live branch before publishing.

## Verification commands

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:behavioral
pnpm build:cli
pnpm pack:local
pnpm smoke:package
```

Run the checks appropriate to an actual change. Documentation-only changes do not justify new model calls. The tests use mocks where labelled; one live-chain suite is opt-in. Historical UI code is not shipped and requires no UI regression run for a lab-only change.

For a deliberately authorized live check: `pnpm guard try good`, then `pnpm guard try trap`. Public equivalents and prerequisites are in the lab guide. These spend OpenAI API credits; no secret is stored by the product. The full pipeline uses `gpt-6-luna`, reasoning `none`; do not silently substitute another model. The hidden prompt or an existing authorized environment supplies the key. Do not copy a key into this handoff, shell arguments, source, logs or a commit. Prior successful access is not proof of current API access or remaining credits.

## Find the implementation

| Concern | Files |
| --- | --- |
| Trial command, lab setup, hidden key input, human choice | `apps/cli/src/lab.ts`, `apps/cli/src/index.ts` |
| Quarantine, ordered stages, coverage/policy, exact-snapshot activation | `packages/core/src/index.ts`, `acquisition.ts`, `analysis.ts`, `storage.ts` |
| Financial text review, numbered source lines, response validation | `packages/core/src/semantic.ts` |
| Unified terminal/Markdown/HTML reports and schemas | `apps/cli/src/full-report.ts`, `packages/contracts/src/index.ts` |
| Installer-to-behavior adapter and local Anvil preflight | `packages/skillguard-lite/src/install-adapter.ts`, `prerequisites.ts` |
| Reference agent, local fork, provenance oracle, task runner | `packages/skillguard-lite/src/agent.ts`, `chain.ts`, `oracle.ts`, `runner.ts` |
| Frozen benchmark and reviewer | `packages/skillguard-lite/src/comparison.ts`, `text-review.ts`, `corpus.ts` |
| Standalone package and offline installation smoke | `scripts/build.mjs`, `scripts/pack.mjs`, `scripts/smoke-package.mjs` |

Regression anchors: `tests/full-pipeline.test.ts`, `tests/lab.test.ts`, `tests/lab-cli.test.ts`, `tests/semantic.test.ts`, `tests/full-report.test.ts`, and `packages/skillguard-lite/tests/install-adapter.test.ts`.

## Evidence and state locations

Committed summaries live in `docs/evidence/`. User-facing local deliverables live in `outputs/skillgate-lab/`. Original private live-run directories are `work/lab-live-v050` and `work/lab-public-v050/run/skillgate-lab`; they are optional local evidence, absent from a normal clone. The original read-only validator is `work/validate-lab-live.py`; it must not be assumed present elsewhere.

Each lab contains reports, `.skillgate` quarantine/evidence/snapshots/install records, and a lab-only `.agents/skills` activation target. Do not install fixtures into the repository's or user's actual discovery directory. Do not publish raw local evidence, usernames, paths, credentials or private account data.

## Before reporting completion again

Distinguish source review, mocked tests, actual API/chain runs and public-package installation. Keep failed attempts in the evidence. Do not relabel old counts as a fresh run. There is no current proof that the synthetic benchmark advantage transfers to documented real attacks. The original multi-stage request is done; further coverage or real-agent integration is a new scope decision.
