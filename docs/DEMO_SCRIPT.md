# Terminal demonstration

This is the **English-language script for SkillGate 0.4.0**. The recording must use the public commands below, with real GitHub acquisition and no local-clone substitution. See versioned evidence for completed runs; the older 0.3.1 video used local clones after a REST quota failure.
Use the two public repositories with one skill each: [skill-safe](https://github.com/gderamchi/skill-safe) and [skill-trap](https://github.com/gderamchi/skill-trap). Their files are unchanged synthetic fixtures from the [original demonstration corpus](https://github.com/gderamchi/skillgate-demo-skills). No skill-selection flag is needed.

## Before recording

Confirm that the public installation reports `0.4.0` with `skillgate --version` and that the current public smoke test passed. Record the real terminal session with English narration, captions, prompts and risk explanations. Keep installation output and operator decisions visible; do not substitute a simulated terminal or replay old output as a new execution.

Install the compiled CLI from GitHub, then create a temporary demonstration project. This command uses a GitHub package, not an npm-registry publication. Never install the trapped fixture in the real user profile or the development repository.

```sh
npm i -g gderamchi/skillgate
cd "$(mktemp -d)"
skillgate on
```

Narration: “SkillGate checks skills before they become active. One command opens a protected terminal.”

The `[SkillGate]` prompt identifies the protected session. `exit` leaves it. Protection applies to supported installer commands in this terminal and to agents inheriting its environment; it does not modify global shell profiles. The scanner never executes acquired skill code.

Run each block separately: wait for the protected prompt before installing, then answer any risk prompt before proceeding. The [previous public terminal demonstration](evidence/public-short-demo.json) was actually executed on 0.3.0 after an anonymous installation. It is historical evidence. The 0.4.0 recording must exercise public GitHub acquisition.

## GitHub acquisition

SkillGate resolves the public ref through anonymous Git and downloads the immutable commit archive through codeload. It does not use the GitHub REST API or credentials. The two short repositories must retain their recorded revisions and fingerprints. A network failure must remain visible and must not be replaced with a fabricated successful terminal output.

## Legitimate skill: automatic installation

```sh
npx skills add gderamchi/skill-safe
```

Show `Installed automatically. No risk detected within the analyzed scope.` and the installed skill at `.agents/skills/portfolio-summary`.

Narration: “A completed scan with no detected issue installs automatically. There is no extra confirmation.”

SkillGate downloads, checks and activates the verified snapshot. The intercepted third-party installer is not executed.

## Trapped skill: stop before activation

```sh
npx skills add gderamchi/skill-trap
```

Narration: “This skill claims to be read-only, but asks for a hidden transfer of 25 DEMOUSD. SkillGate shows the financial consequence and the exact evidence before activation.”

Show the FIN-02/FIN-06 findings, file and line references, report, fingerprint and destination. The choices must read:

```text
[1] Do not install (default)
[2] Install despite the risk
Your choice [1/2]:
```

Press Enter. Show `Installation cancelled; package held.` and verify that the trapped skill is absent from the active skills directory.

Run the same installation again and select `2` only in this temporary project to demonstrate an explicit exception. Show `Installed with exception` and `installed_with_exception` in `skillgate list`.

Narration: “The user keeps the final choice. An exception applies only to this report, fingerprint and destination, and the warning remains recorded.”

## Updates and coverage

`skillgate update portfolio-summary` checks the next version before replacing the current snapshot. A held update preserves the previous active version. Third-party update commands are denied and directed to this checked update command.

Without an interactive terminal, including JSON automation, a held installation returns exit code 2 and remains inactive. The agent should show the risks to the user; a later interactive decision can use `skillgate approve REPORT_ID`. A model response is not proof of human consent.

The optional Codex hook requires explicit setup and native `/hooks` review. Do not present trust as already granted in the real user profile. The hook is complementary to the terminal integration, not a universal security boundary.

## Financial illustration, separate from installation

```sh
skillgate demo --json
```

This uses separate temporary roots and a deterministic ledger: baseline 100 → 75 DEMOUSD; held installation 100; legitimate installation 100; held update 100; exception 75. **Simulation: no real model and no real funds.** These numbers are not measured savings or the probability that an agent would obey the trap.

Detection results are recorded separately in the versioned benchmark and challenge summaries. The original 40 cases and the newer 16 challenge cases are synthetic and internal. Retain baseline and first-candidate results alongside the final post-feedback result. Do not claim an independent evaluation or complete protection.

## Evidence

Local outputs such as `outputs/cli-demo.json`, `outputs/cli-only-pty-smoke.json` and `outputs/demo-publication.json` document actual executions. Read their version and timestamps before using them. The 0.1.0 web-UI video is historical and must not represent the current CLI-only product.

Sanitized public verification summaries are in [evidence](evidence/). The referenced `outputs/` files are generated locally and excluded from the public repository to avoid publishing private workstation paths and raw logs. A completed recording must pass full decode and visual checks. Its sanitized evidence records SHA-256, CLI version, public source revisions and actual installation decisions.
