# External malicious-skill corpus: evidence and limits

Prepared 2026-10-11 for the new security evaluation. The old frozen experiments remain unchanged.

## What was acquired

The new [manifest](../../evaluation/security-v1/corpus/manifest.json) indexes **94 cases and 474 inert files**: 80 externally labelled malicious skills and 14 official upstream controls with unknown security labels. Each retained file has exact bytes, a SHA-256, an original package-relative path and a non-executable `.fixture` name. Nothing was installed; no skill command, attacker endpoint, wallet, blockchain or model provider was used.

The two public research archives and their label manifests were fetched again at pinned commits. Their bytes matched the previously retained source-study copies. The offline verifier checked all 4,958,972 retained bytes, no duplicate primary text hashes, no executable fixtures and no active `SKILL.md` files. These are acquisition-integrity checks, **not detection results**.

## Sources and label strength

| Source | Selected cases | What supports the label | What it does not establish |
| --- | ---: | --- | --- |
| [MaliciousAgentSkillsBench](https://arxiv.org/html/2602.06547v3) | 45 | Authors report manual annotation plus behavioral verification. The original per-case pattern row is retained. Selection takes one case per chosen anonymized repository. | Original attacker commit, victim compromise, independent HoneySkill reproduction, or a universally valid benign/malicious decision boundary. |
| [SkillLeakBench](https://arxiv.org/html/2604.03070v1) | 32 | Source study distinguishes vulnerable from deliberate malicious cases using runtime observations and manual review; pinned consolidation rows label these cases malicious and wild. | A public per-case runtime trace demonstrating every claimed impact. Consolidated attack categories are derived mappings, explicitly labelled as such. |
| [Snyk's incident-linked examples](https://github.com/snyk-labs/toxicskills-goof/blob/80ce2e06f52fd384163c4bd6778676019723773c/README.md), [Google QX4](https://snyk.io/blog/clawhub-malicious-google-skill-openclaw-malware/), [Venustech Bybit report](https://www.venustech.com.cn/new_type/gjywxfx/20260311/29211.html) | 3 | Named artifact or repository/path described by security researchers. Twitter Sum has an exact pinned source link. | The current Bybit and Google paths were pinned after the original reports; their exact incident-version identity is not proven. These were already used in the old coverage probe. |
| Binance, Circle, Anthropic upstream repositories | 14 | Exact source origin and files verified against pinned Git tree blob hashes. | Security certification. All remain `unknown`, excluded from confusion matrices until independent adjudication. |

Research packages come from [MaliciousSkillBench's pinned consolidation](https://github.com/protectskills/MaliciousSkillBench/tree/893afd609be22a2dfac5a2b94bbebb4eeb99515e). Its metadata preserves source provenance and distinguishes wild samples from constructed ones. This import excludes constructed/test-fixture, redacted and sanitized records. It preserves source labels rather than assigning them with HoneySkill's own detector.

That independence is useful, but it is not infallibility: a study can misclassify a package, and a public archive can omit the behavior supporting a label. `groundTruth.adjudicationStatus` is therefore `external-source-label`, while the historical `verifiedBySkillGate` compatibility field remains false. Case-level disagreements need review, not automatic relabelling to make a scanner's score improve.

## Blockchain relevance

The vendor-reported Bybit case is a cryptocurrency-themed fake dependency lure. [OpenSourceMalware's primary campaign report](https://opensourcemalware.com/blog/malicious-clawhub-skills-target-openclaw-users) connects this mechanism to credential and wallet theft. This is evidence of malware distribution aimed at crypto users; it is not a HoneySkill-observed theft or an on-chain recipient-substitution case.

The research corpus also contains `x402_payment_tron`, `polymarket-btc15m`, `better-polymarket`, `nervepay`, `arbitrum-dapp-skill` and `moltiverse-among`. Their companion text/code is retained where present. They help test visibility into key handling, approvals, trading workflows and remote integrations.

For example, retained `x402_payment_tron` text documents private-key discovery and infinite token approval, and its TypeScript implements key discovery. **Those capabilities alone do not prove deliberate theft.** The study's malicious label is external evidence, but no case-specific public theft trace was established here. The same caution applies to intended Polymarket trading and NervePay signing: do not call ordinary secret use, network access or trading malicious without an unauthorized action or independent case evidence.

The 14 controls intentionally contain legitimate financial concepts. They include payment, wallet policy, bridge, swap, token-information, token-audit and USDC workflows. A scanner warning on a control is a review item, not automatically a false positive; conversely a clean scan cannot certify it benign.

## How results must be scored

1. Report source-label detection separately from demonstrated runtime prevention.
2. Keep unsupported tools, missing resources, failed analyses and unknown labels outside TP/FP/TN/FN, while retaining their counts and reasons.
3. State the input modality: primary text, all retained source files, or an actually exercised runtime. A text-only clean result does not test malware hidden in companion code.
4. Report grouped results as well as row counts. The 81 grouping IDs are heterogeneous source-repository, structural and lure-mechanism groups, not independent attack campaigns. Exact primary texts are unique; semantic and cross-source near-duplicates may remain.
5. Treat this as a development corpus. The sources were previously screened, some cases were read while implementing defenses, and model training exposure is unknown. A future validation set must be selected and frozen independently, with related families kept together.
6. Do not claim a measured false-positive rate from the 14 unknown controls. That needs a separately adjudicated benign set under a stated authorization model.

## Completeness and handling

57 selected snapshots have all their published regular files retained; 34 are partial after filtering; 3 are text-only vendor cases. Omitted items are indexed with reason and hash or Git blob ID. Most omissions are generated/binary artifacts; one control configuration example has an unsupported extension. Remote installers, dependencies and shared plugin resources were not fetched. A complete research archive is not proof of a complete original installation environment.

The importer screens narrow high-confidence credential formats and never prints matched material. No selected retained file triggered those patterns. This is a hygiene check, not a guarantee that public source text contains no sensitive data. Samples and source packages retain upstream rights; the consolidator's metadata license does not relicense malware artifacts. Keep this collection local until publication rights and hygiene are separately reviewed.

Acquisition and verification commands are in the [corpus README](../../evaluation/security-v1/corpus/README.md). No detection accuracy, successful attack reproduction or live-chain result is asserted by this corpus delivery.
