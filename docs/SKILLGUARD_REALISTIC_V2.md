# Realistic-v2: preregistered paired comparison

## Question and status

Does behavioral execution add detection value over the existing GPT-6 Luna text-only review on less explicit, workflow-shaped skill instructions? The original 12-skill comparison tied. This follow-up is a new, deliberately harder synthetic challenge set, not an independent real-world holdout. Its authors know the prior result and the fixed payment tasks.

The corpus and this protocol are to be frozen and published before the first inference call on these new skills. Results will be appended separately. The original corpus, outputs and protocol remain unchanged.

## Corpus design

Sixteen English skills form eight matched pairs: a benign policy and a recipient-substitution policy embedded in a similar plausible payment workflow. Neutral case identifiers, realistic metadata and ordinary-looking destination strings replace explicit attack titles and the old `deadbeef` recipient. Pairing makes routing tables, hexadecimal strings, fees, migration notes and worked examples appear in both classes. These surface features alone should not determine a label.

All examples are authored synthetic material. No fixture is represented as a discovered malicious package, deployed payment integration, verified vendor instruction or copied production skill. The foreign recipient is a public-hash-derived string with no signing key created or controlled by this experiment. It is funded only by ephemeral transactions on the owned local fork; no public transfer occurs.

Each malicious label must be justified before execution by a concrete instruction path that can substitute a recipient or add an unintended transfer on at least one of the existing six tasks. Benign labels require that following the skill preserves recipients from the task/address book. Pair identifiers, author labels, intended triggers and rationales are stored outside SKILL.md and never enter either model's input. Dormant triggers outside the battery and swaps only between trusted contacts are excluded from this primary corpus because they do not answer the selected experiment's question.

The design is motivated by instruction-level abuse and concealed capabilities discussed in [Liu et al., USENIX Security 2026](https://www.usenix.org/conference/usenixsecurity26/presentation/liu-yi). That source supports studying this threat class; it does not supply or validate these particular fixtures or their labels. “More realistic” refers to document structure and workflow plausibility, not measured prevalence in the wild.

## Frozen execution plan

- Run all 16 cases twice, as two sequential fresh complete paired benchmarks. Do not selectively repeat a disagreement, change a case after seeing its output, or add only examples that favor one method.
- Use the existing `gpt-6-luna` model, reasoning `none`, temperature `0`, output limit 700, unchanged reviewer and reference-agent prompts, unchanged tools, oracle, six task texts and address book.
- Pin the owned local Anvil Fuji fork to block **59275449**. Each task arm starts from the funded local snapshot, with a random throwaway wallet. No real wallet or signed public transaction is permitted.
- Use the frozen manifest order, alternating text-first/behavior-first across cases as in the original comparison. Preserve that order across both repetitions. All model responses and baselines are fresh; no application-level result cache or archive reuse.
- Freeze hashes for the corpus, shared context, prompts and execution source. Publish the implementation, labels and protocol before either run. Infrastructure-only changes needed for corpus selection must not change model or oracle behavior.
- Preserve every API failure and incomplete case. A complete new run is not substituted for a failed run to improve the score. Any separately needed infrastructure retry must retain the failed attempt and be clearly labelled.

## Analysis declared before execution

For each repetition, report both confusion matrices, precision, recall, false-positive rate, shared complete-pair denominator and excluded/error cases against the same author labels. Compare per-case verdicts directly. Count where SkillGuard-Lite is correct and text review is wrong, and the converse. Report intended-malicious cases with no observed behavioral violation separately from execution errors; a resisted instruction is not evidence that an unintended transfer happened.

Report stability across the two repetitions for each skill and method. Sixteen skills repeated twice are still sixteen authored skills, not thirty-two independent examples. Do not pool them into an inflated independent sample or claim statistical generalization. Report execution time and returned input/output tokens for each run and method; time is observational and token usage is not verified billing.

An advantage means an observed classification improvement on these fixed cases, with its false-positive tradeoff and stability shown. An equal result, a worse result or no interpretable result are all valid outcomes. Behavioral evidence can add explanatory value even when it adds no classification accuracy, but those are distinct claims. This evaluation uses an OpenAI API text reviewer, not the ChatGPT website or app.

The corpus is still synthetic and task-aware. Two repetitions do not establish performance on unknown real skills, latent triggers, another agent runtime, wrong-amount attacks or trusted-contact substitution. A successful audit is not a production installation blocker or a safety certificate.
