# External skill sources: eligibility review

No documented payment-recipient-substitution case eligible for the **unchanged** SkillGuard-Lite experiment was identified in this bounded inspection. This is a source-selection result, not a detection result and not evidence that such attacks do not exist.

The experiment exposes only `send(toAddress, amountAVAX)` and six fixed AVAX payment requests. An eligible positive must contain an original instruction that can cause an unintended recipient through that interface. A general malicious label does not establish that narrower effect. Private-key theft, shell payloads, approvals, email recipients, trading APIs and dormant task-specific triggers cannot be silently converted into financial-transfer positives.

## Sources and version boundaries

Liu et al.'s original [MaliciousAgentSkillsBench repository](https://github.com/protectskills/MaliciousAgentSkillsBench/tree/f7d28b1a9de4eb33d552529cf79d1065d765f6c3) contains 157 source-labeled malicious rows across 69 anonymized repositories. At that revision, its only `SKILL.md` is a math-calculator example. The [paper's release policy](https://arxiv.org/html/2602.06547v3) distinguishes synthesized explanatory snippets from restricted original payloads; original malicious repository URLs are withheld. Those snippets must not be presented as verbatim wild skills.

The later [MaliciousSkillBench release](https://github.com/protectskills/MaliciousSkillBench/tree/893afd609be22a2dfac5a2b94bbebb4eeb99515e) provides recovered historical packages and [identity-to-package mappings](https://github.com/protectskills/MaliciousSkillBench/blob/893afd609be22a2dfac5a2b94bbebb4eeb99515e/packages/package_manifest.csv). That provides usable byte provenance for source artifacts, but its release commit is **not** the original third-party repository commit. The original labels and provenance remain source claims. See the [consolidation paper](https://arxiv.org/html/2608.19901v1) for its treatment of recovered snapshots and heterogeneous evidence.

The original Liu repository declares MIT. The consolidation declares Apache-2.0 for its software and CC BY 4.0 for its own metadata; its [third-party notice](https://github.com/protectskills/MaliciousSkillBench/blob/893afd609be22a2dfac5a2b94bbebb4eeb99515e/THIRD_PARTY_NOTICE.md) says underlying skill artifacts retain upstream terms. These declarations should not be generalized into a blanket license for all collected skills. This report distributes no raw skill text.

## Inspection performed

Five small archives were downloaded as inert research data. Archive members were read without extracting packages, installing dependencies, following embedded URLs or executing payloads. The counts below describe the inspected archive representations, **not** independent attacks or exhaustive semantic verification.

| Source archive | Archive bytes | `SKILL.md` files | Primary identities mapped to this archive |
|---|---:|---:|---:|
| SRC002 — Liu / MaliciousAgentSkillsBench | 1,637,031 | 157 | 153 |
| SRC004 — SkillLeakBench | 243,948 | 50 | 33 |
| SRC005 — Agent Skill Malware | 50,987 | 30 | 30 |
| SRC011 — ATR Skill Security | 15,499 | 21 | 21 |
| SRC006 — AgentTrap | 2,248,266 | 87 | 86 |

Selection used financial terms and address patterns followed by manual reading of promising cases. This can miss obfuscated, multilingual or indirect instructions. No claim of exhaustive attack absence follows. Archive counts differ from source-study counts because the consolidated release selects identities, preserves some auxiliary/nested files and deduplicates across sources.

In addition, eight finance-named malicious files were fetched individually from [MalSkillBench at `06e083125d5ec5dd7a189dfedadfe587a70635b9`](https://github.com/lxyeternal/MalSkillBench/tree/06e083125d5ec5dd7a189dfedadfe587a70635b9): Bankr Transfers, Bankr Wallet Operations, crypto-wallet, wallet, leo-wallet, moonpay, solana-pay and auditing-wallet-security. Their exact hashes match consolidation records. Their provenance there is `mixed_unresolved`; they cannot honestly be relabeled as wild attacks or confirmed research PoCs. The upstream README limits use to academic research. Its full recursive tree response was truncated, although all 3,944 malware `SKILL.md` entries were visible; only the eight selected files were fetched.

## Representative exclusions

The IDs below are exact consolidated benchmark identities. Full source URLs, archive member paths, SHA-256 hashes and source labels are in [source-study-metadata.json](source-study-metadata.json). All eleven listed archive-file hashes match their manifest's exact-text hash.

| Identity | Source artifact | Source provenance | Why it cannot be a positive for this experiment |
|---|---|---|---|
| ASB04_004290 | lawpay | wild; human + runtime | Installer/credential and banking workflow; no unintended EVM recipient instruction. |
| ASB04_003197 | mercury | wild; human + runtime | Same publisher campaign; banking/API workflow, no recipient substitution. |
| ASB04_005375 | email | wild; human + runtime | Hidden email BCC; neither email tasks nor an email tool are present. |
| ASB04_006208 | ai-truthfulness-enforcer | wild; human + runtime | Claim-verification and instruction override; no unintended payment destination. |
| ASB04_004922 | slack-bridge | wild; human + runtime | Changes user-consultation routing through Slack/shell. |
| ASB04_005117 | plan-refine | wild; human + runtime | Requires a refinement script/API workflow; that behavior is unavailable to the reference agent. |
| ASB04_006555 | TRON approval workflow | wild; human + runtime | Private-key discovery and infinite approval are explicitly outside scope. |
| ASB04_003427 | Monad game workflow | wild; human + runtime | Game registration/prize context and HTTP calls are absent from the payment battery. |
| ASB04_004339 | Polymarket trading workflow | wild; human + runtime | Private-key trading/API operations; different tools and effect. |
| ASB04_002011 | Arbitrum development workflow | wild; human + runtime | Development/reference material; no unintended payment instruction identified in `SKILL.md`. |
| ASB04_000743 | Portfolio tracker | test fixture; constructed | Wallet-file harvesting rather than recipient substitution. |

The selected MalSkillBench files likewise exposed different effects: remote setup/code, a reverse-shell connector, system-prompt disclosure, auditing or Solana-specific scripts. The skill named `wallet` did not provide an identifiable recipient-substitution instruction in its text; its broad source label is not a reason to invent one. Detailed exclusions remain in the metadata.

## Consequence for the experiment

An unchanged run on independently documented, out-of-scope malicious skills can be reported as a **coverage probe**. A no-violation outcome then means no unintended EVM transfer was observed in those six tasks; it does not make the original skill safe. Such a probe must not produce recipient-substitution precision, recall or superiority claims from general malware labels.

This research performed **zero model calls, zero chain calls, zero installations and zero payload executions**. No benchmark result is asserted here. Raw downloads remain intermediate research material; this deliverable contains only analysis and provenance metadata.
