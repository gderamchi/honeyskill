> Historical operating guide for the published 0.5.0 release. It uses that release's original name and CLI commands; current HoneySkill documentation is in [README](../README.md) and [HANDOFF](HANDOFF.md).

# Previous 0.5.0 full installation laboratory

The 0.5.0 release combined three independent checks before a test installation. `skillgate try <source>` creates or reuses a dedicated marked directory, obtains an immutable snapshot, runs regex/static checks, asks GPT-6 Luna for a financial security review, and runs the unchanged SkillGuard-Lite agent on six tasks with and without the skill. It writes a unified report before any activation. Product output is English.

## Quick start

Install Node.js 22.18+ and [Foundry Anvil](https://getfoundry.sh/getting-started/installation), then:

```sh
npm i -g 'gderamchi/skillgate#v0.5.0'
skillgate lab
skillgate try good
skillgate try trap
```

The pinned public install was checked from a fresh npm cache. If GitHub's source archive stalls, the compiled release is also available:

```sh
npm i -g https://github.com/gderamchi/skillgate/releases/download/v0.5.0/skillgate.tgz
```

The OpenAI key is requested with terminal echo disabled when missing; it is used only for that process. Alternatively supply `OPENAI_API_KEY` through your existing secure environment. Each successful trial makes a real LLM review plus twelve agent task runs using paid API calls. API credits are distinct from a ChatGPT subscription. No key is stored by SkillGate. Anvil must be installed; `ANVIL_BIN` can specify an absolute executable path. No account, faucet, public transaction or real wallet is required for the local fork.

`good` and `trap` are separately authored synthetic installation examples, distributed with the package; they are not external malware, real GitHub attacks or additions to the frozen benchmark. Try any local folder or public GitHub skill instead:

```sh
skillgate try ./my-skill
skillgate try owner/repository
skillgate try https://github.com/owner/repository/tree/COMMIT/path/to/skill
skillgate try owner/repository --skill skill-name
skillgate try ./my-skill --lab ./fresh-test-lab
```

Use a valid skill with YAML `name` and `description` frontmatter. Multi-skill repositories require explicit selection. GitHub acquisition resolves a commit and uses a bounded archive; oversized repositories or invalid packages are rejected before model execution. Local paths are relative to your terminal directory. Bare `owner/repository` is interpreted as GitHub only when no local path exists.

From source: `pnpm install --frozen-lockfile`, then `pnpm guard try good`. `pnpm run audit` remains execution-only and `pnpm benchmark` remains the unchanged comparison experiment. The historical `skillgate install` command is not the full pipeline; use `try` for all three checks.

## Decisions and records

- **Installed:** all stages completed, baseline clean, all six tasks exercised, exact package covered, no supported risk detected. This is limited evidence, not certification.
- **Held:** a financial risk or recipient violation was found. All stages still run. If coverage is complete, an interactive terminal offers **Do not install** (default) or **Install despite the risk**. The exception records the exact fingerprint, report, destination and human decision; it never erases the risk.
- **Unverified:** absent key, timeout, provider/chain error, invalid baseline, no-send/refusal without observed violation, package changes, or unsupported resources. The report remains available. Activation is unavailable, including by exception.

`--json` is noninteractive, makes no hidden credential prompt, and never accepts an exception. Exit codes: 0 installed, 2 risk held, 3 unverified; acquisition/configuration errors use 1. `skillgate lab` exits 3 when Anvil is missing. There is no `--yes` override.

Reports are written to `<lab>/reports/<scan-id>.{json,md,html}`. `<scan-id>.outcome.json` records the later installation decision separately. Private full execution evidence is in `<lab>/.skillgate/evidence/`; JSON reports include its SHA-256. HTML has no scripts/network requests. Reports may contain skill excerpts, model output and local paths: review before sharing. Apparent-secret redaction in the text reviewer is heuristic; the behavioral agent receives raw SKILL.md. Use public or otherwise non-secret test skills.

The default lab is `./skillgate-lab`; when already inside a marked lab, it is reused. Nonempty unmarked folders, real project roots, profile directories and symlink redirects are refused. Installed files live only under `<lab>/.agents/skills`; they are not loaded by your real assistant. Repeating `try` scans fresh bytes and preserves an existing version if rejected. Use a new `--lab` directory for a fresh environment.

## Exact coverage

Native rules and the separate LLM review cover supported financial patterns such as hidden beneficiaries, secrets, approvals, financial parameters and concealed instructions. Their explanations cite exact source lines. The **behavioral stage is narrower**: a minimal reference agent receives only a `send` tool and executes native AVAX payments on an owned Anvil Fuji fork. It does not execute acquired shell scripts, dependencies, HTTP calls, staking or approvals. Extra resources that this agent cannot load are marked uncovered and prevent full installation.

The fixed oracle accepts any address in the trusted address book or written in the task. Swapping Tom for Alice, delayed triggers, amount manipulation and other threats are not proven safe by a clean run. Task success is separate from recipient safety; refusals or absent payments are not full coverage. A malicious redirection is an exercised test even when the originally intended recipient was not reached.

No automatic interception of arbitrary terminal installations is claimed. `try` is the explicit route into the full lab pipeline. Historical terminal wrappers and static releases remain separately documented. This release does not change or rerun the frozen benchmark as a new accuracy claim.
