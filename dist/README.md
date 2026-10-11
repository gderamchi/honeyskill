<p align="center"><img src="assets/honeyskill/logo.png" alt="HoneySkill honey jar" width="150"></p>

# HoneySkill

**AI proposes. Your policy authorizes.**

HoneySkill inspects agent skills and checks proposed financial actions against explicit user authorization before they reach the execution adapter. The hackathon PoC replays six scripted action proposals, including a changed recipient, hidden charge and unrequested unlimited approval, through a real local transaction adapter.

Formerly SkillGate. This is **0.6.0-dev.0**, local development for Secure Horizons, Track 1 — Guardians of Value. HoneySkill source is published at [gderamchi/honeyskill](https://github.com/gderamchi/honeyskill); the original [SkillGate repository](https://github.com/gderamchi/skillgate), published `v0.5.0` and its evidence remain unchanged. The `skillgate` command is retained as a compatibility alias.

## Run the payment demonstration

Requires Node.js 22.18+, pnpm and [Foundry Anvil](https://getfoundry.sh/getting-started/installation). From this source checkout:

```sh
pnpm install --frozen-lockfile
pnpm build:cli
mkdir -p outputs
node dist/cli.js payment-demo --out outputs/payment-demo
```

The default checks the public Avalanche Fuji RPC with read-only requests and starts an owned local fork. The report records the exact fork block and distinguishes a fallback local genesis run. Use `--local` to request local genesis explicitly. All signatures and transactions stay on the disposable loopback chain. No real wallet, public transaction, API key or model call is required.

To produce an installable archive:

```sh
pnpm pack:local
npm i -g ./outputs/gderamchi-honeyskill-0.6.0-dev.0.tgz
honeyskill payment-demo --out outputs/payment-demo-installed
honeyskill --help
```

The HoneySkill package is not yet published to npm. An existing global SkillGate package can conflict with the legacy binary alias; use an isolated npm prefix or intentionally remove the old package before replacing it.

## What the PoC proves

Four authored payment scenarios produce six fixed proposed actions. Exactly the same proposals run from identical local snapshots with direct execution and with the financial monitor. The report keeps policy decisions, chain receipts, balance changes and task completion separate. See [scenario provenance and execution scope](public-demo/README.md) and the [prospective model comparison protocol](public-demo/PAIRED_MODEL_PROTOCOL.md).

The recorded local Fuji-fork execution blocked all three unauthorized actions while preserving all three exact legitimate payments: action-level TP 3, TN 3, FP 0, FN 0; 36/36 execution checks passed. These are six deterministic decisions on constructed scenarios. They do not measure unseen-malware detection or model resistance to prompt injection. The substituted-recipient scenario is held; this fixed replay does not replan the payment. The approval case uses a minimal local allowance-storage witness, not a complete ERC-20 token.

The policy microbenchmark reports its own warmup, repetitions and observed timing. It excludes the model, RPC and mining. The decision path calls no model; an end-to-end "cheaper, faster, more accurate than normal AI" comparison has not been established.

## Architecture and integration boundary

```text
Untrusted skill ──► static + semantic inspection ──► findings and coverage report
Human payment intent ──► trusted typed authorization
Agent proposed action ──► deterministic financial monitor ──► execution adapter
                                     │
                                     └──► deny reason + evidence + human review
```

Inspection combines native checks, Cisco Skill Scanner 2.2.2 and a modular LLM semantic reviewer. The separate action monitor uses a declared subset of the Progent static policy checker plus typed financial policies restricting recipients, amounts, chain, fees, approvals, swaps, secret access and allowlist changes. The demonstration exercises only its documented subset. This is not a complete CaMeL or Progent implementation.

The monitor protects actions routed through its adapter. It is not universal terminal interception, a production wallet integration, or a sandbox for arbitrary downloaded scripts. Trusted authorization is a separate input; accepting an attacker-edited authorization would invalidate the boundary. Reports are standalone files, not a hosted web application.

## Evaluation: successes and failures remain visible

[Public distribution note](docs/PUBLIC_DISTRIBUTION.md): third-party samples are withheld pending redistribution review; all recorded case outcomes and failures remain visible.

The latest inspection development rerun used all 114 unchanged cases. Among 80 malicious-labelled cases: **18 TP, 14 FN, 48 incomplete**. Among 20 constructed benign controls: **7 FP, 12 TN, 1 incomplete**. Fourteen unknown-label cases are reported separately. This tuned development corpus is not an unseen holdout; unsupported cases are never counted as safe. [Full before/after evidence](docs/evidence/security-v1/repair-2026-10-11/report-public.md) · [Case explorer](docs/evidence/security-v1/repair-2026-10-11/cases-public.html).

The small deterministic payment demo tests containment, whereas this corpus tests skill inspection. Their denominators and claims must not be combined. [Security methods and limits](docs/SECURITY_V1.md) · [Preserved SkillGate experiments and releases](README-SKILLGATE-HISTORY.md).

## The original installation laboratory

The existing trial remains available:

```sh
honeyskill lab
honeyskill try good
honeyskill try trap
honeyskill try ./my-skill
```

Live trials spend OpenAI API credits and use GPT-6 Luna, reasoning none. They inspect the exact quarantined snapshot, run the preserved six-task AVAX behavioral battery, and save a unified report before activation. Activation is allowed only inside a marked dedicated lab. Incomplete checks or changed bytes cannot be overridden; complete risky results require an explicit interactive exception. Bundled `good` and `trap` are authored examples. [Lab guide](docs/SKILLGATE_LAB.md).

## Development

```sh
pnpm typecheck
pnpm test
pnpm test:behavioral
pnpm build:cli
pnpm pack:local
pnpm smoke:package
```

Read [AGENTS.md](AGENTS.md), [handoff](docs/HANDOFF.md), [current state](docs/PROJECT_STATE.md), and [ADRs](docs/adr/README.md) before modifying the project. Preserve frozen protocols, evidence, third-party provenance and redistribution restrictions. Never commit credentials, private logs or workstation paths.
