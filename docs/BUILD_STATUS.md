# SkillGate 0.3.1 — English CLI verified

Updated 10 October 2026. The current product is a CLI with checks before skill installation. The user replaced the original local web-UI requirement with terminal integration, then requested an English-default product and video.

## Current 0.3.1 status

The CLI source now uses English for help, setup, risk choices, installation messages, protected-session messages, hook explanations and exported HTML reports. The safe path remains automatic; the risky path still defaults to cancellation and requires explicit choice `2` for an exception. No language-selection layer or change to detection behavior is intended.

The [actual local 0.3.1 validation](evidence/local-validation-0.3.1.json) passed typecheck, 47 tests, 13 PTY decision scenarios, 10 protected-session checks, seven packaged-terminal interception cases, the CLI build, isolated simulation, packaging and installation outside the repository. The [translation parity check](evidence/english-translation-validation.json) confirmed 32/32 detection regexes and 40/40 case outcomes unchanged, and the frozen benchmark rerun completed with the same totals. The [public 0.3.1 installation verification](evidence/public-short-install-0.3.1.json) also passed: anonymous GitHub installation, ten real terminal checks, a fresh public clone with 47 passing tests and typecheck, and a byte-identical rebuilt CLI. The [English terminal video](evidence/english-terminal-video-0.3.1.json) is complete: 48 seconds, 1080p, actual public CLI execution against verified local Git clones of the two public synthetic skills. It shows automatic installation, cancellation of the held trap, then explicit exception. Direct GitHub API acquisition hit HTTP 403 in a prior take; the video does not claim to show that acquisition path succeeding. Historical public results below remain versioned evidence.

## Implemented product scope

- Static financial-risk analysis, quarantine, readable evidence, fingerprints and activation of the verified snapshot. Held updates preserve the previous active version.
- CLI only, with no web server or web assets in the shipped package. Clean skills install automatically. Risk choices are `Do not install (default)` and `Install despite the risk`. Neither `--yes` nor JSON output accepts risk.
- `skillgate on` opens a dedicated Bash session and activates wrappers for supported npx/pnpm/skills commands and processes inheriting its environment. The check replaces the installer before execution. `exit` leaves the session; global shell profiles and user history remain untouched.
- Unsupported global or ambiguous options, multiple sources, third-party updates and interactive searches that can install are denied with an explanation.
- An optional Codex `PreToolUse` hook preserves other hooks and uses native `/hooks` trust review. The product does not bypass that trust decision or modify the agent sandbox.
- The public [original demo corpus](https://github.com/gderamchi/skillgate-demo-skills) and single-skill [safe](https://github.com/gderamchi/skill-safe) / [trap](https://github.com/gderamchi/skill-trap) repositories contain synthetic fixtures. The scanner never executes their code.
- Short public commands remain `npm i -g gderamchi/skillgate`, then `skillgate on`. Distribution uses a compiled GitHub package, not the npm registry. Anonymous public installation of 0.3.1 is verified in the linked evidence.

## Completed historical verification: 0.3.0

The [public 0.3.0 installation verification](evidence/public-short-install.json) passed anonymous `npm i -g gderamchi/skillgate` installation with a fresh cache, then ten real-terminal checks of `skillgate on`. A fresh public clone passed 45 tests and typecheck; rebuilding produced exactly the installed CLI bytes. `npx --yes gderamchi/skillgate --version` also worked.

The [public short demonstration](evidence/public-short-demo.json) records actual automatic installation from the safe repository, cancellation of the trapped skill, explicit exception and a successful exit from the protected session. Its version and language remain historical; it is not the new English video.

Local `outputs/cli-validation.json` and logs cover typecheck, tests, build, PTY decisions, isolated simulation, packaging and installation outside the monorepo. `outputs/cli-only-package-smoke.json` also records real npx/pnpm/skills commands against the installed package, with the upstream installer never executed for intercepted cases. `outputs/cli-only-pty-smoke.json` covers thirteen decision and interruption flows. These files must be interpreted by their recorded version and execution time.

## Completed historical verification: 0.2.1 and original demo

The [public package](evidence/public-package.json) and [public source](evidence/public-source.json) checks passed for 0.2.1. The rebuilt public-source CLI and the publicly installed tarball CLI had identical SHA-256 hashes. The fresh clone passed 43 tests; the installed package passed thirteen PTY flows. Demo skills were acquired from the public repository without authentication.

`outputs/demo-publication.json` records public URLs, Git revision, anonymous requests and scan reports for the original demo release v0.1.0. Its ZIP was downloaded and checked against published fingerprints. Legitimate and trapped fixtures were analyzed from the ZIP and a pinned GitHub revision in temporary roots: the legitimate skill became active, while the trap was held with FIN-02/FIN-06 findings and remained absent from the active directory.

`outputs/codex-hook-smoke.json` separately records testing with the real Codex CLI and a simulated local model provider. Its conditions must accompany any native-integration claim; it does not prove execution by a real model.

The old 0.1.0 web sources and video remain historical work artifacts and are excluded from the CLI product.

## Detection evidence and remaining limits

The frozen benchmark and the actual 0.3.1 rerun both recorded 11/16 suspicious cases detected, five missed, 4/16 false positives and 11/16 legitimate cases allowed. Seven of eight incomplete cases were held, and one acquisition error produced no activation. This is an internal synthetic evaluation, not an independent assessment. The [English translation parity check](evidence/english-translation-validation.json) confirmed all 32 detection regexes and all 40 case outcomes unchanged.

- **Distribution:** GitHub source and compiled packages were publicly verified for 0.3.1. No npm-registry release is claimed. During the English recording, direct fixture acquisition hit the anonymous GitHub API rate limit (HTTP 403) and activated nothing; Git-cloned local sources avoid that API but remain a distinct acquisition path.
- **Coverage:** other installers, unsupported agents, absolute binaries bypassing the wrappers, manual copies and processes without the protected PATH remain outside scope. This is not universal system monitoring or a transaction firewall.
- **Codex:** a trusted project, native hook authorization and permission to write the skill directory are required. Hooks may fail open on startup errors or timeouts and do not intercept `write_stdin`.
- **Detection quality:** improve false negatives and false positives on a separate development set, then evaluate without rewriting the frozen benchmark.
- **Not executed:** a real model/provider, the Cisco comparison, a paid provider and Fuji transactions. Static mode does not require these integrations.
- **Hackathon:** confirm exact track alignment with the mentor and obtain the missing official common deliverables.

No real user profile was modified, no real funds or secrets were used, and no demonstration fixture was activated in this development repository. All exception demonstrations use explicitly temporary projects.

Sanitized public summaries are in [evidence](evidence/). Referenced `outputs/` files are local execution artifacts and remain excluded from the public repository to avoid exposing workstation paths or raw private logs.
