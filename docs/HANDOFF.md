> **Current branding update (11 October 2026):** active development is now HoneySkill. Read [the hackathon update](HONEYSKILL.md) for the new controlled payment demonstration and submission artifacts. The release and inspection evidence below are preserved.

# HoneySkill — start here when resuming

Updated 2026-10-11 after the frozen security-v1 repair rerun and its independent before/after audit. Published 0.5.0 remains unchanged. An independent holdout and causal runtime-prevention evaluation remain outstanding; user instructions and applicable AGENTS.md take precedence.

## Read in this order

1. [Root instructions](../AGENTS.md), then [behavioral package instructions](../packages/skillguard-lite/AGENTS.md) when working there.
2. [Current project state](PROJECT_STATE.md): delivered work, validation, limitations and remaining decisions.
3. [Security v1 runbook](SECURITY_V1.md): active experimental architecture, commands, hashes, evidence boundaries and next-run protocol.
4. [Architecture decisions](adr/README.md): six retrospective release records plus ADR 0007 for the new scope. Read the [preserved 0.5.0 lab workflow](PREVIOUS_INSTALLATION_LAB.md) for its historical commands and evidence.
5. [Latest repair comparison](evidence/security-v1/repair-2026-10-11/report.md), [first live evaluation](evidence/security-v1/live-2026-10-11/report.md), [earlier offline evidence](evidence/security-v1/report.md) and its [error analysis](research/security-v1-error-analysis.md); [historical release evidence](evidence/skillgate-lab/report.md). Read linked JSON before repeating a measurement.
6. Only for benchmark work: [comparison protocol](SKILLGUARD_COMPARISON.md), [realistic-v2 protocol](SKILLGUARD_REALISTIC_V2.md) and [external coverage probe](evidence/skillguard-lite/real-world/report.md).

## Current objective and stopping point

The five-part 0.5.0 laboratory delivery remains complete. The subsequently authorized security effort now has a locally validated implementation, offline and live development-corpus results and portable evidence. It is **not fully validated as a general security solution**: combined detection remains weak and an independently adjudicated holdout is outstanding. Do not restart historical web work or paid frozen benchmarks to recover context.

Local version is `0.6.0-dev.0`; published `v0.5.0` is unchanged. New source commands are `security inspect`, `benchmark`, `verify`, `policy-test`, `exercise` and `chain-proof`, invoked through `pnpm guard security ...`. They integrate actual Cisco 2.2.2, dedicated `security-semantic-2` review (SG-01–SG-04 and FIN-01–FIN-06 in deterministic source batches), evidence/scoring and a Progent static-checker subset with a deterministic financial monitor. Guarded model exercises use explicitly simulated effects. Separately, actual owned-local-chain proof passed 16 assertions across five synthetic proposed actions: four denied before dispatch and one exact native payment mined on fresh chain 31337. No acquired scripts execute or activate. See the runbook for flags, hashes and a trusted policy example.

The [latest repair run](evidence/security-v1/repair-2026-10-11/report.md), 04:01:17–04:10:32 UTC on 2026-10-11, preserved all 114 cases, labels, source files and inspected snapshots. Results: TP 18 / FN 14 / incomplete 48 among 80 malicious-labelled cases; FP 7 / TN 12 / incomplete 1 among 20 constructed controls; 13 completed unknowns and 1 incomplete unknown. Although both positive totals have 32 eligible cases, only 30 are shared: their TP count rises 9 → 16 (30.0% → 53.3% paired recall). All 16 paired controls remain FP 4 / TN 12; the three newly eligible controls are false positives.

The original 22 FNs become 9 TP, 12 FN and 1 partial. Of the original 48 incomplete positives, 2 become TP and 46 remain incomplete. Two previous TPs regress to FN and one to partial. These outcomes remain in the reports. The code was tuned using the baseline failures, so this is a disclosed development repair, not independent or unseen validation.

The run recorded 367 unique GPT-6 Luna responses, reasoning none, zero retries and 8,309,767 tokens—about 10.88 times the first run's inspection-only token work. Seven partial batches across six semantic stages remain visible. Independent checks verified all 616 corpus file hashes, every request's source-ID list/input hash and 545 retained semantic citation locations; these checks do not establish label correctness. Latest local checks: 264 application passes / 2 skips and 74 preserved behavioral passes / 1 skip; typecheck, build, pack and offline package smoke passed. CI was not run. No acquired code was executed; no real wallet, activation or publication was involved. Credentials were not persisted.

The earlier final 94-case offline run records TP 7 / FN 25, 49 incomplete/excluded and 13 completed unknown cases. Positive coverage is 32/80 (40%); conditional recall 21.875%; observed detection floor 7/80 (8.75%). The separate 20-case constructed controls record FP 7 / TN 12 / partial 1 (36.8% conditional research-control FPR, not real-world FPR). See [portable results](evidence/security-v1/report.md) rather than interpreting the counts as whole-pipeline security accuracy.

Earlier local implementation validation: 251 application tests passed / 2 skipped, 74 preserved behavioral tests passed / 1 skipped; typecheck, CLI build, local pack and both offline package smoke paths passed. Those earlier checks were not repeated for the first live measurement; the repair checks above are a separate later validation. CI was not run and nothing new was published.

The [first live development run](evidence/security-v1/live-2026-10-11/report.md) completed at 03:36:52 UTC on 2026-10-11 using GPT-6 Luna, reasoning none, zero retries. It recorded 111 unique API responses (99 inspections, 12 guarded exchanges), 774,085 returned tokens and no source changes. Combined external results: TP 10 / FN 22 on 32/80 positives; 48 positive cases incomplete. Controls: FP 4 / TN 12 / 4 unsupported. On identical eligible rows, adding semantic review gives three additional positive-label alerts and no reduction in false positives. Six synthetic guarded cases completed exact simulated payments, but zero unauthorized proposals means zero observed interceptions. A separate fresh Anvil proof passed 16 assertions. The user supplied the key through masked local input; it was not persisted. Do not retrieve old credentials or rerun this paid batch merely to recover context.

The preserved public command `honeyskill try <source>` still runs regex/static rules, GPT-6 Luna and six-task SkillGuard-Lite on one snapshot. It reports before lab-only activation; incomplete analysis, changed bytes and mocks cannot authorize it. The new commands do not replace that release behavior.

## Locate the actual checkout

Run `pwd`, `git rev-parse --show-toplevel` and `git status --short` before edits. In a normal clone, work directly in that repository. In the original projectless workspace, the working source directory is not itself a Git repository; its publication checkout is `work/product-publication`. That layout is local workflow history, not a requirement for a new clone. Do not create a nested repository or overwrite unrelated changes to make the layout match.

Current source repository: [gderamchi/honeyskill](https://github.com/gderamchi/honeyskill). The preserved `v0.5.0` release remains in the earlier [gderamchi/skillgate repository](https://github.com/gderamchi/skillgate) at product commit `41fca4d8ec9422eebe32043b4006cc95c91dac72`. Its evidence-only follow-up is `c26762ac71038bb43e1fdd4bd9c672cbf3e5a3b0`; later handoff documentation does not change that released runtime.

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
| Preserved release financial text review, numbered source lines, response validation | `packages/core/src/semantic.ts` |
| Security-only semantic batching, source IDs, request ledger and extra static text support | `packages/security-lab/src/semantic.ts`, `text-inventory.ts`, `redaction.ts` |
| Unified terminal/Markdown/HTML reports and schemas | `apps/cli/src/full-report.ts`, `packages/contracts/src/index.ts` |
| Installer-to-behavior adapter and local Anvil preflight | `packages/skillguard-lite/src/install-adapter.ts`, `prerequisites.ts` |
| Reference agent, local fork, provenance oracle, task runner | `packages/skillguard-lite/src/agent.ts`, `chain.ts`, `oracle.ts`, `runner.ts` |
| Frozen benchmark and reviewer | `packages/skillguard-lite/src/comparison.ts`, `text-review.ts`, `corpus.ts` |
| Standalone package and offline installation smoke | `scripts/build.mjs`, `scripts/pack.mjs`, `scripts/smoke-package.mjs` |

Regression anchors: `tests/full-pipeline.test.ts`, `tests/lab.test.ts`, `tests/lab-cli.test.ts`, `tests/semantic.test.ts`, `tests/full-report.test.ts`, and `packages/skillguard-lite/tests/install-adapter.test.ts`.

New development modules: `apps/cli/src/security.ts`, `packages/security-lab/src/` and `packages/security-policy/src/`. New tests are under `tests/security-*.test.ts`. Engine provenance, policy assumptions, Progent parity and corpus labels are documented separately in `docs/research/security-v1-*.md`.

## Evidence and state locations

Committed summaries live in `docs/evidence/`. User-facing local deliverables live in `outputs/skillgate-lab/`. Original private live-run directories are `work/lab-live-v050` and `work/lab-public-v050/run/skillgate-lab`; they are optional local evidence, absent from a normal clone. The original read-only validator is `work/validate-lab-live.py`; it must not be assumed present elsewhere.

Each lab contains reports, `.skillgate` quarantine/evidence/snapshots/install records, and a lab-only `.agents/skills` activation target. Do not install fixtures into the repository's or user's actual discovery directory. Do not publish raw local evidence, usernames, paths, credentials or private account data.

New inert corpora are in `evaluation/security-v1/corpus/` (94 cases: 80 external malicious labels, 14 unknown controls) and `negative-corpus/` (20 constructed AgentTrap benign controls). Their frozen manifest hashes and caveats are in the security runbook. Keep them separate from the old benchmark. The source labels are independent of HoneySkill predictions but do not establish real-world incident reproduction. Constructed negatives with explicit benign cues cannot establish an in-the-wild FPR. Redistribution rights remain unresolved.

## Before reporting completion again

Distinguish inspection, reference-checker parity, proposed-action authorization, mocks, simulated effects, actual API/chain runs and public installation. Preserve failures and denominators; do not relabel historical results as fresh. The [offline evidence](evidence/security-v1/report.md), [first live evidence](evidence/security-v1/live-2026-10-11/report.md) and [repair comparison](evidence/security-v1/repair-2026-10-11/report.md) expose detection and coverage limits; they do not prove real blockchain-campaign prevention or transfer of the old synthetic advantage. Independent holdout adjudication and task-compatible runtime attack witnesses remain required.
