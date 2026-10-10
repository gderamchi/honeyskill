# SkillGate — current project state

As of 2026-10-10. Read [HANDOFF.md](HANDOFF.md) first when resuming. This status describes 0.5.0; older status documents and results are historical.

## What is delivered

| Requested work | Implemented behavior |
| --- | --- |
| Simple test environment | `skillgate lab` checks prerequisites; `skillgate try` automatically creates/reuses a dedicated marked lab. Real profiles, nonempty unmarked roots and unsafe paths are refused. |
| One installation attempt | `skillgate try good`, `trap`, a local folder or public GitHub source; multi-skill repositories can use `--skill`. |
| Complete analysis pipeline | Native regex/rules → GPT-6 Luna financial review → six paired behavioral scenarios. Findings do not skip later stages. Missing/error/unsupported stages remain visible and cannot auto-install. |
| Report and human decision | HTML, Markdown and JSON are saved before activation. A clean complete snapshot installs automatically. Complete risky results offer decline or a recorded exception. Exceptions do not erase findings. |
| Tests and distribution | Version 0.5.0 is published on GitHub as source, compiled CLI and release archive. Same-name rejected updates preserve the previous version; package bytes and public installations were checked. |

The shipped product has no web server or web application. HTML is a standalone local report. The full path is explicitly invoked with `try`; the historical `install`/`on` commands are not universal full-pipeline interception.

## Last verified evidence, not a fresh run on every read

Release code: `41fca4d8ec9422eebe32043b4006cc95c91dac72`, tag [v0.5.0](https://github.com/gderamchi/skillgate/releases/tag/v0.5.0). Runtime and reports use English. Node.js 22.18+, pnpm for source development, OpenAI SDK, viem and local Foundry Anvil are used; Anvil 1.8.5 was verified in the release environment.

- **127 application tests and 74 behavioral tests passed**, with one optional live-chain test skipped. Typecheck, build, pack and offline package smoke passed. These are local results, not a CI-green claim.
- Fresh public CLI: benign synthetic fixture installed after all stages, 39.5 seconds, zero observed recipient violations.
- Fresh public CLI: malicious synthetic fixture held after all stages, 39.9 seconds, two observed recipient violations. Before approval the report existed and the target was absent. Choosing 2 installed the exact snapshot with an exception and retained the MALICIOUS verdict.
- Five actual release-development trials are retained, including one failed semantic-citation attempt. After numbered source lines were introduced, the checks passed without relaxing exact quotation validation. The records contain 125 native API responses and 51,278 returned tokens; usage is not a verified invoice.
- Three public installation paths succeeded with byte-identical CLI builds. The initial unpinned archive streamed slowly (~198 seconds), while the pinned retry took 4 seconds and the compiled asset 1 second. A 20-second bounded attempt failed on npm's SSH fallback. These timings are observations, not a delivery SLA.

Sources: [release report](evidence/skillgate-lab/report.md), [tests](evidence/skillgate-lab/tests.json), [public install hashes](evidence/skillgate-lab/public-install.json), [actual-run consistency checks](evidence/skillgate-lab/validation.json). No suite or paid run was repeated merely to write this handoff.

## Important fixes already completed

Exact source-line numbering for LLM evidence; public recipient addresses preserved during heuristic secret redaction; bounded requests without silent retries; evidence retention beyond 36 attempted recipient violations; refusal of mocked behavioral evidence at installation; no implicit execution of Anvil binaries planted in the inspected working directory; bundled runtime data and licenses; help/early-input validation; report-before-activation and same-name update preservation tests.

## What remains limited or undecided

There is no known unfinished item from the delivered laboratory request. The following are boundaries or possible future work, not silently authorized commitments:

1. **Real agent integration:** full checks do not automatically intercept every installer or install into a real Codex/Claude/user profile. A concrete integration boundary and its failure behavior would need to be selected and tested.
2. **Execution coverage:** the agent gets only `send` on six AVAX tasks. It does not execute skill scripts, helper dependencies, shell/download attacks, approvals, staking or key theft. Packages requiring uncovered resources are unverified. Do not remove this block merely to make more skills install.
3. **Oracle scope:** any book contact or address literally present in the task is allowed. Tom-to-Alice swaps, amount-only changes, negative address mentions, delayed triggers and untested contexts remain limitations. A clean finite run is not certification.
4. **External validity:** the realistic-v2 synthetic runs observed 8/8 malicious detections behaviorally versus 7/8 text-only, with zero false positives on eight benign fixtures. The unchanged real-GitHub probe had five skills, all BENIGN under the narrow oracle; its documented shell attacks were out of scope. External precision/recall/FPR and a real-world gain remain N/A. See [synthetic report](evidence/skillguard-lite/realistic-v2/comparison-report.md) and [external report](evidence/skillguard-lite/real-world/report.md).
5. **Operations and credentials:** model/RPC availability, credits and GitHub download latency can change. The CLI needs an authorized key and Anvil; key presence is not authentication proof. Raw SKILL.md reaches the behavioral provider, so use non-secret test inputs. No automatic credit purchase or credential persistence exists.
6. **Future hackathon submission:** historical pitch/video files do not establish that a current external submission has been made. Confirm actual organizer requirements only if asked to prepare/submit it.

## Keep distinct

`pnpm benchmark` is the frozen text-only versus behavioral experiment. The full installation LLM stage checks broader financial patterns and is not that benchmark's comparator. `pnpm run audit` is behavioral-only; `pnpm audit` is pnpm's unrelated dependency audit. Legacy static scores, ledger simulations and videos are not new live-model evidence.

Maintain this file after a meaningful delivery. Preserve old evidence and add a dated measurement when rerunning; do not edit past results into a better outcome.
