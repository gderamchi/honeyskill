# SkillGate

Financial-risk checks **before installing agent skills**. A local CLI with terminal interception, not a wallet, transaction firewall or web platform.

SkillGate downloads the skill into quarantine and inspects its files without executing acquired code. A complete scan with no detected risk automatically installs the verified snapshot. A finding or incomplete analysis explains the evidence and offers **Do not install** (default) or **Install despite the risk**. Truncated packages cannot be activated, even with an exception.

## Install and activate

Requires macOS/Linux, Node.js 22.18+ and Git. Install once or update:

```sh
npm i -g gderamchi/skillgate
```

In the project you want to protect:

```sh
skillgate on
```

The **[SkillGate]** prompt identifies the protected terminal session. Install skills using the supported commands below. Type **exit** to return to the original shell.

`on` starts a dedicated Bash session without loading shell startup files or changing your shell profile. Commands and agents launched from this session inherit its environment. Other terminals and already-running applications are not activated. Project settings and installed skills persist when the session closes.

The GitHub shorthand installs the committed, precompiled CLI: no npm account, API key, local compilation, server or browser is required. Current version: **0.3.1**, with English CLI messages and reports. The package is also distributed through GitHub releases; it is not published to the npm registry as `skillgate`.

## Two short demo commands

Use an isolated temporary project for these synthetic fixtures:

```sh
cd "$(mktemp -d)"
skillgate on
```

Then run each command separately:

```sh
npx skills add gderamchi/skill-safe
npx skills add gderamchi/skill-trap
```

The first skill installs automatically. The second declares read-only behavior but requests a concealed fictional transfer: SkillGate holds it and explains FIN-02 and FIN-06 with file and line evidence. Press Enter to cancel. To demonstrate an exception, run the same trap command again and choose `2`. SkillGate records the exact fingerprint and destination with status `installed_with_exception`.

Without an interactive terminal, the suspect package stays held with exit code 2. Review it later with `skillgate approve SCAN_ID`. An installer's `--yes` never accepts a SkillGate risk. The scanner does not execute either fixture or any financial transaction.

## Supported installation paths

- `npx skills add/install SOURCE`, including `npx -y skills@VERSION add SOURCE`.
- `pnpm dlx skills add/install SOURCE`.
- `skills add/install SOURCE`.
- Explicit `skillgate install SOURCE`, local directories and public GitHub repositories.
- Updates through `skillgate update NAME`: a rejected update preserves the existing installed snapshot.

The MVP targets **one skill at a time, for Codex in the current project**, under `.agents/skills`. Global installs, unsupported agents, multiple skills, unsupported options and third-party update commands are rejected. Interactive discovery commands that could install a skill are also rejected. Unrelated commands are delegated to the original executable.

To switch projects, exit the protected session, change directory and run `skillgate on` again.

## How it works

1. **Intercept.** `skillgate on` places small `npx`, `pnpm` and `skills` wrappers first on PATH. Supported installation commands are routed to SkillGate before the upstream installer executes.
2. **Acquire.** Read local files or fetch a public GitHub revision into quarantine outside the agent's skill-discovery directory. Reject incoming links, unsafe paths and collection limits.
3. **Inspect.** Inventory the files, build a canonical SHA-256 manifest, check references and dependencies, then apply local financial-risk heuristics. Files are untrusted data, never instructions to the scanner.
4. **Decide.** Risk and analysis coverage are separate. A complete supported scan with no findings can auto-install. Otherwise the CLI explains the problem and waits for an explicit decision.
5. **Activate.** Recheck the snapshot's fingerprint and promote that exact copy. The active directory points to the verified snapshot. Updates replace the pointer atomically; an exception applies only to this report, fingerprint and destination.

Reports, quarantine, snapshots and installation history stay under `.skillgate/`. There is no telemetry or remote database. These files are not tamper-proof against the owner of the operating-system account.

## Financial checks and measured limits

The static engine uses pattern matching and contextual combinations, not an LLM by default:

| Check | Pattern being flagged |
| --- | --- |
| FIN-01 | Requests to collect and transmit financial secrets, such as a seed phrase or private key. |
| FIN-02 | Transfers or beneficiary replacement conflicting with read-only claims or accompanied by concealment. |
| FIN-03 | Broad spending approvals, including unlimited allowances. |
| FIN-04 | Concealed changes to financial settings such as network, token, RPC or slippage. |
| FIN-05 | Remote or obscured code acquisition combined with execution in a financial context. |
| FIN-06 | Hidden instructions to sign, approve or transfer without telling the operator. |

These are heuristic checks, not complete coverage of those threats. The frozen internal synthetic evaluation contains 40 cases: **11/16 suspect cases detected, 5 missed, 4/16 false positives**; 11/16 legitimate cases auto-install; 7/8 incomplete cases are held and one acquisition error prevents activation. It was authored by the same assistant as the implementation and is not an independent blind evaluation. Passing implementation tests does not imply reliable detection of all malicious skills.

The corpus distinguishes real source reports from synthetic financial hypotheses and inert fixtures. `skillgate demo` uses a fictional 100 → 75 DEMOUSD ledger; it does not demonstrate an actual model following an attack or real money being saved.

An optional OpenAI Responses provider is implemented and tested with simulated responses. No real paid provider execution has been verified. Hybrid mode requires an explicit model, API key and content-sharing consent; it cannot remove native findings or silently fall back to static mode on failure. Source excerpts and historical reports retain their original language.

## Boundaries

PATH interception covers supported commands in the activated session and descendants inheriting its environment. It does not cover manual copies, absolute executable paths that bypass wrappers, arbitrary installers, environments that replace PATH, commands passed to an already-running shell through `write_stdin`, or processes started before activation. It does not control transactions or agent behavior after installation. A local process can deliberately bypass or alter the protection.

An optional Codex `PreToolUse` hook provides additional command rewriting:

```sh
skillgate enable --codex-hook --json
skillgate on
```

Codex requires the hook to be reviewed and trusted through `/hooks` in a trusted project. SkillGate does not grant that trust or modify sandbox permissions. The native Python installer is supported only with an explicit destination matching this project's `.agents/skills`.

The integration was exercised using the real Codex CLI and a local simulated model. That proves the hook path under those test conditions, not every agent or sandbox. A real `workspace-write` test could analyze the skill but denied writing `.agents` with `EPERM`; installation still requires host write permission. Codex hook startup errors or timeouts can allow a command through before SkillGate runs. The hook is not a security sandbox.

## Other commands

```sh
skillgate scan /path/to/skill --json
skillgate install /path/to/skill
skillgate update skill-name
skillgate inspect scan-ID
skillgate approve scan-ID
skillgate list
skillgate doctor
skillgate report scan-ID --format html --output report.html
skillgate demo --json
skillgate benchmark --json
skillgate export --json
skillgate prune --json
```

`--project DIRECTORY` selects the project root; `--json` reserves stdout for JSON and disables interactive questions. `scan` never installs. `prune` removes explicitly expired inactive data while retaining active snapshots. `enable` and `env` remain available for existing automated integrations.

Exit codes: 0 success, 1 error, 2 held/cancelled/decision required, 3 missing configuration, 130 interruption. Errors never authorize an installation through SkillGate.

## Develop and verify

Source builds additionally require pnpm 10.33.0 and Python 3 for ZIP and PTY checks:

```sh
pnpm install --frozen-lockfile
pnpm validate
# Build only:
pnpm build:cli
```

Validation covers type checking, tests, a compiled CLI build, real terminal interactions, an isolated simulation, packaging and installation outside the repository. Sanitized public evidence is in [docs/evidence](docs/evidence/); raw workstation logs are excluded.

The CLI bundle has no external runtime dependencies and excludes the archived web UI, server, React and Vite. Historical `apps/web` and `server.ts` sources remain for provenance. The initial specification is preserved in `docs/SPECIFICATION.md`; the later user scope removes the web UI from the shipped product.

The build script must remain named `build:cli`: a root npm script named `build`, `prepare` or another preparation lifecycle hook would cause npm to rebuild a Git dependency during installation. The public repository therefore commits `dist/`; development tools stay in devDependencies.
