# SkillGuard-Lite terminal UX review

**Verdict: usable for a developer after setup, but not yet as simple as it could be.** The experiment runs from one command once configured. First-run setup, discoverability and coexistence with the old SkillGate CLI still create avoidable friction. A web interface or new CLI package is unnecessary to fix this.

Reviewed public commit [`449d085183813c98940c2a2cdcf1431ddc33eff1`](https://github.com/gderamchi/skillgate/tree/449d085183813c98940c2a2cdcf1431ddc33eff1), using the existing fresh public clone. The working tree remained unchanged. The commands below were actually executed; error cases are deliberately unsuccessful probes, not live audit results.

## Actual terminal checks

| Command / condition | Observed result |
| --- | --- |
| `pnpm run audit --help` | Exit 1: `Unsupported argument: --help`. |
| `pnpm benchmark --help` | Exit 1: `Unsupported argument: --help`. |
| `pnpm exec tsx packages/skillguard-lite/src/main.ts --help` | Exit 0: correct project help, but the discoverable path is long and exposes an implementation detail. |
| `pnpm audit --help` | Shows pnpm's dependency-vulnerability audit, not SkillGuard-Lite. The README correctly requires `pnpm run audit`; omitting `run` changes the tool. |
| `pnpm run audit` | Exit 1 with a clear explanation that a skill folder containing `SKILL.md` is required. |
| `pnpm run audit packages/skillguard-lite/fixtures/benign-helpful`, API key absent | Exit 1: `OPENAI_API_KEY is required. No live audit was performed.` |
| `pnpm run audit does-not-exist`, API key absent | Reports the missing API key before detecting the invalid folder. |
| `pnpm check:fork --out <new-report.json>`, `ANVIL_BIN` deliberately points to a nonexistent executable | Exit 1: Anvil could not start; message suggests installing Foundry or setting `ANVIL_BIN`. The failed check preserves a JSON report. |
| `pnpm run audit does-not-exist --out <new-report.json>`, synthetic unused key and missing Anvil | Reports the Anvil failure before the invalid skill folder. No model request occurred. |
| `node dist/cli.js --help` | Still advertises the historical SkillGate installer commands (`on`, `scan`, `add`, `approve`, etc.), not the behavioral experiment. |

## What already works well

- The normal repeat-use command is straightforward: `pnpm run audit ./my-skill`.
- The script owns the fork, funds a throwaway wallet and cleans up. Users need no real wallet, faucet, Builder Hub account or public transaction.
- Missing key/folder errors are understandable. Verdicts, evidence paths and saved JSON/Markdown outputs make results inspectable.
- The README explicitly separates current behavioral results from historical static detection, and explains that API credits are separate from a ChatGPT subscription.

## Smallest useful improvements

1. **Make help work at every entry point.** Accept `--help`/`-h` on each subcommand. Add one predictable package script such as `pnpm skillguard audit ./my-skill` and `pnpm skillguard --help`; this avoids the built-in `pnpm audit` collision without creating a new binary or package.
2. **Check local prerequisites before network work.** Validate the skill folder, readable `SKILL.md`, API-key presence and Anvil executable first; show a concise checklist with the next corrective command. The invalid-folder probe currently reaches fork setup before examining the input.
3. **Lead with a compact fresh-install guide.** The user needs a checkout plus Node.js, pnpm, Anvil and an authorized OpenAI key. Put those steps and the secure key prompt together near the top; the current README links Anvil documentation and sends the user to a separate demo document for the full sequence.
4. **Separate active entry points from historical ones more visibly.** Terminal package banners still say `@gderamchi/skillgate@0.4.0`, and the committed old binary exposes a different product. Keep the historical release and evidence, but clearly label these commands as legacy in the active developer entry points.
5. **Make long-running work legible.** Show a compact task/skill counter and elapsed time, then verdict + first violation + evidence path. Before a benchmark, state that it makes fresh API calls for every arm and does not reuse earlier results. No new UI is required.

These are recommendations only; no implementation was changed during this review.

## Limits of this review

No fresh model audit, benchmark, dependency installation, global/profile installation or paid API request was performed. No real API key or wallet secret was read or used. One deliberately fake key was used only to reach a local prerequisite error. Missing-Anvil checks made read-only Fuji RPC requests before failing; no Anvil process or wallet was created and no transaction was submitted. Existing success traces and documentation were inspected, not rerun or relabelled as new evidence. This review measures a developer terminal journey, not novice usability with independent participants.
