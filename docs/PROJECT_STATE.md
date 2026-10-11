> **Current branding update (11 October 2026):** active development is now HoneySkill. Read [the hackathon update](HONEYSKILL.md) for the new controlled payment demonstration and submission artifacts. The release and inspection evidence below are preserved.

# SkillGate — current project state

As of 2026-10-11. Read [HANDOFF.md](HANDOFF.md) first. Published 0.5.0 and its measured results remain unchanged; local `0.6.0-dev.0` is experimental security-v1 development.

## Active security-v1 development

The user authorized concise reviewable benchmarks, documented external malware, research-backed defenses and blockchain checks. Source implementation includes native/Cisco 2.2.2 inspection and dedicated `security-semantic-2` review of SG-01–SG-04 plus FIN-01–FIN-06 in deterministic source batches, per-engine scoring with incomplete/unknown outcomes, a declared Progent static-checker subset, and a host-issued financial authorization monitor. `security exercise` lets GPT-6 Luna propose mediated typed actions with simulated effects. `security chain-proof` separately runs native transfers on an owned ephemeral Anvil chain; arbitrary skill scripts are never executed.

Status: **implemented; offline, first live and frozen repair development evaluations recorded; not published; independent holdout and causal runtime-prevention evaluation outstanding**. The actual packaged-CLI local-chain run passed 16 assertions for five synthetic proposed actions: four unauthorized attempts caused zero executor calls; one exact authorized payment mined, with transaction fields, receipt, balances and nonce verified. It uses fresh genesis 31337, an in-memory throwaway key and no public RPC. This is distinct from offline policy tests, mocked model transport and real-malware detection.

The [latest repair evaluation](evidence/security-v1/repair-2026-10-11/report.md), 2026-10-11 04:01:17–04:10:32 UTC, reran all 114 original cases once with unchanged labels, files and inspected snapshots. Combined results are **18 TP / 14 FN / 48 incomplete** among the 80 positive labels, **7 FP / 12 TN / 1 incomplete** among the 20 constructed controls, and **13 completed unknowns / 1 incomplete unknown**. Positive coverage remains 32/80 (40%); conditional recall is 56.25% and detection floor 18/80 (22.5%). These are development-sample observations, not a safety guarantee.

Only **30 positive cases are eligible in both runs**, despite the two 32-case totals. On those identical rows, TP/FN change from 9/21 to 16/14 (30.0% → 53.3%). The 16 paired controls remain FP 4 / TN 12. Three newly eligible controls are all FP, giving a full eligible-control FPR of 7/19 (36.8%). Two old TPs become FN and one becomes partial. Original 22 FN: 9 become TP, 12 remain FN, 1 becomes partial. Original 48 incomplete positives: 2 become TP, 46 stay incomplete. No failure, disputed label or old attempt was removed.

The repairs add bounded source batching, host-resolved citation IDs, extra UTF-8 static formats, broader security categories and defensible Cisco citation normalization. They do not modify the preserved financial installation reviewer or execute acquired code. A frozen protocol preceded the single revised pass; baseline failures informed development, so this is not an unseen holdout. There were 367 unique model responses and 8,309,767 tokens (8,285,720 input + 24,047 output), about 10.88 times the prior inspection-only token work. Seven partial batches across six semantic stages remain failures. Independent audits recalculated both runs, verified 616 corpus files and exact request plans, and checked 545 retained citation locations. These checks do not independently adjudicate malicious intent.

Latest local validation: **264 application passes / 2 skips; 74 preserved behavioral passes / 1 skip**; typecheck, CLI build, local pack and offline package smoke passed. CI was not run; nothing new was published. Credentials were supplied through masked input and not persisted. Existing guarded-model and local-chain proofs below were not rerun as part of this inspection repair and do not establish new prevention evidence.

Earlier full offline native/Cisco benchmarks completed against frozen code. External 94: TP 7, FN 25, incomplete/excluded 49, completed unknown 13. Only 32/80 positive-labelled packages were eligible (40% coverage); recall on those is 21.875%, while 7/80 gives an 8.75% detection floor. Constructed controls 20: FP 7, TN 12, partial 1; conditional FPR 36.8%, not an estimate for real deployed skills. On the same 32 positive rows native has 3 TP / 29 FN and Cisco 7 TP / 25 FN; on the same 19 negatives native has 3 FP, Cisco 4 and their union 7. The current static detector is not an effective general malware classifier on this development data.

Earlier recorded [local validation](evidence/security-v1/validation.json): 251 application tests passed / 2 optional skips; 74 preserved behavioral tests passed / 1 optional live-Fuji skip. Typecheck, build, pack and both offline package smokes passed; Cisco and local chain were exercised separately. Those earlier checks were not rerun for the first live measurement; CI was not run. Review the [offline result summary](evidence/security-v1/report.md) and [error analysis](research/security-v1-error-analysis.md) before quoting the historical static metrics.

The [first live development evaluation](evidence/security-v1/live-2026-10-11/report.md), 2026-10-11 03:31:31–03:36:52 UTC, used the same code/corpus hashes: 114 package inspections scheduled, 99 actual semantic responses (98 complete, one invalid-citation partial); 15 cases exceeded the existing 64 KiB limit without an API call. Combined positives: TP 10 / FN 22 / incomplete 48; recall 31.25% on 32/80 eligible positives, detection floor 12.5%. Constructed negatives: FP 4 / TN 12 / unsupported 4. The same 32 positive rows improve from 7 to 10 alerts; the same 16 negative rows remain FP 4 / TN 12. The lower raw FP count is exclusion, not demonstrated improvement. Source labels and alert mechanisms still require independent adjudication.

Six live synthetic guarded cases produced six exact simulated payments, 12 responses, no unauthorized proposals and no monitor interceptions. They validate integration/utility, not prevention gain. Separately, a fresh owned-Anvil native-transfer proof passed all 16 assertions. Total recorded API usage: 111 unique responses, 767,520 input + 6,565 output = 774,085 tokens; not a verified invoice. No acquired code execution, real wallet, public transaction, activation or publication occurred. The user supplied a key through masked local input only; it was not persisted.

The new inert corpus contains 80 external-source malicious labels plus 14 unknown official controls. A separate 20-case AgentTrap cohort supplies author-intended, task-conditioned constructed negatives. Nine of those explicitly reveal benign labels; they support an overblocking smoke test, not real-world FPR. Missing files, unknown labels, errors and unsupported behavior remain separate from confusion matrices. The collection is development data, not an unseen holdout, and redistribution rights are unresolved.

Read [SECURITY_V1](SECURITY_V1.md) for commands, exact artifact hashes, architecture, claim boundaries and a preregistered independent evaluation protocol. Research notes cover [Cisco](research/security-v1-research.md), [Progent](research/security-v1-progent.md), [financial checks](research/security-v1-policy.md), [malicious labels](research/security-v1-corpus.md) and [constructed negatives](../evaluation/security-v1/negative-corpus/README.md). No result currently proves SkillGate prevented a real blockchain-malware campaign.

## Completed published 0.5.0 delivery

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

There is no known unfinished item from the delivered 0.5.0 laboratory request. These remain release boundaries; the separately authorized security-v1 development above does not retroactively widen its execution or benchmark claims:

1. **Real agent integration:** full checks do not automatically intercept every installer or install into a real Codex/Claude/user profile. A concrete integration boundary and its failure behavior would need to be selected and tested.
2. **Execution coverage:** the agent gets only `send` on six AVAX tasks. It does not execute skill scripts, helper dependencies, shell/download attacks, approvals, staking or key theft. Packages requiring uncovered resources are unverified. Do not remove this block merely to make more skills install.
3. **Oracle scope:** any book contact or address literally present in the task is allowed. Tom-to-Alice swaps, amount-only changes, negative address mentions, delayed triggers and untested contexts remain limitations. A clean finite run is not certification.
4. **External validity:** the realistic-v2 synthetic runs observed 8/8 malicious detections behaviorally versus 7/8 text-only, with zero false positives on eight benign fixtures. The unchanged real-GitHub probe had five skills, all BENIGN under the narrow oracle; its documented shell attacks were out of scope. External precision/recall/FPR and a real-world gain remain N/A. See [synthetic report](evidence/skillguard-lite/realistic-v2/comparison-report.md) and [external report](evidence/skillguard-lite/real-world/report.md).
5. **Operations and credentials:** model/RPC availability, credits and GitHub download latency can change. The CLI needs an authorized key and Anvil; key presence is not authentication proof. Raw SKILL.md reaches the behavioral provider, so use non-secret test inputs. No automatic credit purchase or credential persistence exists.
6. **Future hackathon submission:** historical pitch/video files do not establish that a current external submission has been made. Confirm actual organizer requirements only if asked to prepare/submit it.

## Keep distinct

`pnpm benchmark` is the frozen text-only versus behavioral experiment. `pnpm guard security benchmark` is the new package-inspection evaluator, with separate provenance and completeness accounting. The full installation LLM stage checks broader financial patterns and is not the old comparator. `pnpm run audit` is behavioral-only; `pnpm audit` is pnpm's unrelated dependency audit. Legacy static scores, ledger simulations and videos are not new live-model evidence.

Maintain this file after a meaningful delivery. Preserve old evidence and add a dated measurement when rerunning; do not edit past results into a better outcome.
