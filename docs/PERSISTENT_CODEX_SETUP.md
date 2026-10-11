# Persistent Codex installation checks

HoneySkill 0.6.0-dev.1 adds a project-local setup. Run it once in each agent repository. It pins the bundled installer inside `.skillgate/runtime/` and registers `.codex/hooks.json`. Removing or upgrading the global npm package does not remove that pinned installer. No shell activation is required for later Codex sessions.

From the agent repository, one command downloads HoneySkill and configures it. No global install or `--agent codex` flag is required:

```sh
npx -y gderamchi/honeyskill#v0.6.0-dev.1 setup
```

Then start Codex normally. The pinned runtime remains available after the npx cache is removed. This exact command passed with an isolated home and fresh npm cache; see [one-command setup evidence](evidence/persistent-codex-2026-10-11/one-line-setup.json).

In Codex, open `/hooks`, review and trust the HoneySkill project hook. Codex requires this initial human trust step; HoneySkill does not forge or bypass it. Start a new Codex session after setup. Later sessions load the same trusted project hook automatically. Changing the hook definition, moving the repository or updating the pinned runtime can require another review.

Now ask Codex to install a skill normally, for example with `npx skills add owner/repository --skill skill-name`. Supported `npx skills`, `pnpm dlx skills`, `skills` and explicit project-targeted native Codex installer calls are replaced before execution with HoneySkill's guarded installer. Commands from repository subdirectories are covered. Known ambiguous, global or unsupported installer forms are denied rather than run upstream. A noninteractive risky result stays held. Every scan saves a JSON report before activation in `.skillgate/reports/`.

When globally installed, `honeyskill doctor` reports the configured hook and analysis profile. With npx, use `npx -y gderamchi/honeyskill#v0.6.0-dev.1 doctor`. It does **not** establish that Codex trusted, loaded or enabled the hook; check `/hooks` and an actual intercepted installation. `honeyskill enable` remains an alias-compatible setup command. Its stdout still contains optional shell exports for existing `eval "$(honeyskill enable)"` callers. `honeyskill on` remains a temporary protected terminal.

## Which checks run

The default is local static analysis. To require the modular semantic reviewer too, explicitly consent and select the model:

```sh
npx -y gderamchi/honeyskill#v0.6.0-dev.1 setup --profile hybrid --semantic-consent --model gpt-6-luna
```

The authorized OpenAI key must be supplied through the environment of the Codex process. HoneySkill does not store it. Missing credentials, failed semantic analysis or incomplete supported coverage do not auto-install. Hybrid checks spend API credits. Static/hybrid inspection is separate from the three-stage `try` pipeline; full behavioral activation remains restricted to a dedicated marked laboratory. Do not present this integration test as full-pipeline or unseen-malware accuracy evidence.

## Manual jury demonstration

Use a disposable agent repository and authored fixtures. Download fixture bytes without executing them:

```sh
mkdir -p /tmp/honeyskill-jury/agent /tmp/honeyskill-jury/clean /tmp/honeyskill-jury/trap
git -C /tmp/honeyskill-jury/agent init
curl -fsSL https://raw.githubusercontent.com/gderamchi/honeyskill/v0.6.0-dev.1/fixtures/portfolio-legitimate/SKILL.md.fixture -o /tmp/honeyskill-jury/clean/SKILL.md
curl -fsSL https://raw.githubusercontent.com/gderamchi/honeyskill/v0.6.0-dev.1/fixtures/portfolio-suspicious/SKILL.md.fixture -o /tmp/honeyskill-jury/trap/SKILL.md
cd /tmp/honeyskill-jury/agent
npx -y gderamchi/honeyskill#v0.6.0-dev.1 setup
codex
```

Trust `/hooks` once. Ask Codex to run the following commands **separately**, allowing its normal filesystem approval when needed. Codex's workspace sandbox can protect `.agents/skills`; this setup does not weaken that sandbox.

```sh
npx skills add /tmp/honeyskill-jury/clean --agent codex -y
npx skills add /tmp/honeyskill-jury/trap --agent codex -y
```

The first authored fixture should install. The second should be held, preserving the first same-name installation. Show the rewritten HoneySkill command, findings with source lines, saved reports and `.agents/skills/portfolio-summary/SKILL.md`. Close Codex, reopen it in the same repository and repeat the trap command: no new setup or `eval` is needed. These fixtures are constructed examples, not documented real attacks. The actual results and coverage in the report take precedence over this expected demonstration.

## Failure boundary

The registered command checks the pinned runtime SHA-256, bounds its child to five seconds and converts a missing Node executable, missing/changed runtime, crash, invalid response or child timeout into a native tool denial. A successful guard does not silently fall back to the upstream installer.

Codex remains the host. An untrusted/disabled hook, an outer host timeout or host failure can skip the hook or continue the original tool. This is not an operating-system sandbox or universal installation interception. Manual copies, arbitrary scripts/file writes, other tools/agents, global targets and commands run outside Codex without shell activation are outside the integration boundary. A malicious process with the user's filesystem privileges can alter or remove project policy. Strong enforcement across every installation channel requires an agent loader or OS boundary that mandates the gate and independently refuses unverified bytes.

## Reproduce integration evidence without credentials

```sh
pnpm build:cli
node scripts/codex-hook-smoke.mjs
pnpm pack:local
pnpm smoke:package
```

The Codex smoke uses the installed open-source Codex CLI, three independent sessions, one setup, authored local fixtures and a deterministic loopback Responses mock. It removes the original installer before sessions start, checks clean install and risky hold, then corrupts the pinned runtime and verifies denial before shell execution. It checks that the upstream installer never ran. It uses an isolated `HOME` and `CODEX_HOME`; it does not read or modify user authentication/trust. The explicit test-only hook-trust bypass is recorded and is **not evidence of persisted human trust**. The isolated test sandbox setting is not a product setting. Private logs stay in `outputs/`; publish only sanitized summaries.
