# SkillGate security evaluation

2026\-10\-10T23:58:35\.063Z. Development external corpus; static package inspection, not a blind holdout or malware execution.

- Attempted: 94
- TP 7; FN 25; FP 0; TN 0
- Incomplete/excluded: 49; completed unlabelled: 13
- All labels: 80 malicious; 0 benign; 14 unknown
- Conditional recall: 21.9%; FPR: N/A
- Labelled coverage: 32/80 (40.0%)
- Positive coverage: 32/80 (40.0%)
- Detection floor (TP / all labelled positives): 8.8%; excluded cases remain abstentions
- Exclusions: error=0; unsupported=0; partial=19; notRequested=0; missingEngine=0; partialPackage=29; coverageGap=1

## Case index

| Case | Ground truth | Result | Package |
| --- | --- | --- | --- |
| src002\-asb04\-004290 — lawpay | malicious | TP | complete-preserved-snapshot |
| src002\-asb04\-006841 — platform\-porter | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-004213 — sqlite\-agent\-amplification | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-005135 — github\-multi\-repo | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-000790 — Shadcn UI Designer | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-006140 — github\-workflow\-automation | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-002790 — notion\-export | malicious | PARTIAL_ANALYSIS | partial-filtered |
| src002\-asb04\-005215 — database | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-001790 — flow\-nexus\-platform | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-002582 — Sacred Space Protocol | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-003205 — pptx | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-002010 — test\-strategy | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-002647 — e2e\-validator | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-003321 — github\-code\-review | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-001880 — TailAdmin UI Patterns | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-003947 — using\-superpowers | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-003838 — developer\-growth\-analysis | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-006027 — vercel\-deploy | malicious | TP | complete-preserved-snapshot |
| src002\-asb04\-006882 — flow\-nexus\-swarm | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-001441 — brainstorm | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-004548 — hacs | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-000086 — jetaasc\-newsletter | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-003376 — context7 | malicious | PARTIAL_PACKAGE | partial-filtered |
| src002\-asb04\-006531 — gemini\-image | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-000536 — codex\-chat | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-002341 — hive\-mind\-advanced | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-000511 — pptx | malicious | PARTIAL_ANALYSIS | partial-filtered |
| src002\-asb04\-007422 — hello | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-006208 — AI Truthfulness Enforcer | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-007263 — weekly\-plan | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-005375 — email | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-000757 — setup\-claude\-skills\-for\-web | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-004314 — browser\-automation | malicious | TP | complete-preserved-snapshot |
| src002\-asb04\-004356 — network\-conftest\-generator | malicious | TP | complete-preserved-snapshot |
| src002\-asb04\-003489 — Hooks Automation | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-004252 — page | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-003000 — agentic\-jujutsu | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-002842 — infra\-tester | malicious | TP | complete-preserved-snapshot |
| src002\-asb04\-000439 — my\-skill | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-001630 — ccw\-maven\-setup | malicious | TP | complete-preserved-snapshot |
| src002\-asb04\-003374 — graphics\-api\-hooking | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-003158 — runpod\-ops | malicious | FN | complete-preserved-snapshot |
| src002\-asb04\-004922 — slack\-bridge | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-004098 — chrome\-devtools | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src002\-asb04\-004620 — stealth\-ops | malicious | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| src004\-asb04\-002011 — arbitrum\-dapp\-skill | malicious | PARTIAL_ANALYSIS | partial-filtered |
| src004\-asb04\-002949 — nervepay | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-004339 — polymarket\-btc15m | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-006555 — x402\_payment\_tron | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-006438 — bird | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-001045 — bomb\-dog\-sniff | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-002179 — skillguard | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-003082 — nano\-banana\-antigravity | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-000952 — secure\-sync | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-003022 — devinism | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-005884 — cron\-writer | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-006923 — dsiprouter | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-006263 — excel | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-003128 — govpredict\-ai | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-001417 — antigravity\-image | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-003288 — better\-polymarket | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-003427 — moltiverse\-among | malicious | PARTIAL_ANALYSIS | partial-filtered |
| src004\-asb04\-006033 — linkedin | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-005298 — molt\-security\-auditor\-v3 | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-005622 — moltbook | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-000233 — totally\-legit\-skill | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-003303 — twitter\-openclaw\-2 | malicious | PARTIAL_ANALYSIS | partial-filtered |
| src004\-asb04\-000893 — gmail\-client\-PM | malicious | COVERAGE_GAP | complete-preserved-snapshot |
| src004\-asb04\-004884 — query\-optimizer | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-006358 — recruitment | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-002076 — reddit\-trends | malicious | PARTIAL_ANALYSIS | partial-filtered |
| src004\-asb04\-004950 — openclaw\-watchdog | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-003932 — wed | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-001195 — coding\-agent | malicious | TP | complete-preserved-snapshot |
| src004\-asb04\-003548 — deep\-research | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-006380 — wacli | malicious | PARTIAL_PACKAGE | partial-filtered |
| src004\-asb04\-004116 — youtube\-watcher | malicious | PARTIAL_PACKAGE | partial-filtered |
| control\-binance\-onchain\-pay — onchain\-pay | unknown | PARTIAL_ANALYSIS | partial-filtered |
| control\-binance\-binance\-agentic\-wallet — binance\-agentic\-wallet | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-binance\-binance\-wallet\-tracker — binance\-wallet\-tracker | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-binance\-query\-token\-audit — query\-token\-audit | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-binance\-query\-token\-info — query\-token\-info | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-circlefin\-agent\-wallet\-policy — agent\-wallet\-policy | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-circlefin\-bridge\-tokens — bridge\-tokens | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-circlefin\-pay\-via\-agent\-wallet — pay\-via\-agent\-wallet | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-circlefin\-swap\-tokens — swap\-tokens | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-circlefin\-use\-user\-controlled\-wallets — use\-user\-controlled\-wallets | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-circlefin\-use\-usdc — use\-usdc | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-circlefin\-use\-circle\-cli — use\-circle\-cli | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-anthropics\-brand\-guidelines — brand\-guidelines | unknown | UNLABELLED | complete-preserved-snapshot |
| control\-anthropics\-frontend\-design — frontend\-design | unknown | UNLABELLED | complete-preserved-snapshot |
| vendor\-twitter\-sum — twitter\-sum | malicious | PARTIAL_PACKAGE | partial-text-only |
| vendor\-sundial\-bybit — bybit\-trading | malicious | PARTIAL_ANALYSIS | partial-text-only |
| vendor\-google\-qx4 — google\-qx4 | malicious | PARTIAL_PACKAGE | partial-text-only |

## Family / source groups

These are correlated groups, not independent campaigns. Full grouped matrices are retained in JSON and HTML.

| Group | Attempted | TP | FN | FP | TN | Excluded |
| --- | --- | --- | --- | --- | --- | --- |
| src002:rest\_1049 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_1169 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_154 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_1575 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_167 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_2154 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:rest\_2313 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:rest\_234 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_2347 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_2872 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:rest\_3016 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:rest\_3018 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:rest\_3103 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_330 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_342 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_416 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:rest\_658 | 1 | 1 | 0 | 0 | 0 | 0 |
| src002:smp\_10280 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_1139 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_1160 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_1535 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_170 | 1 | 1 | 0 | 0 | 0 | 0 |
| src002:smp\_2332 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_2343 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_2362 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_2370 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_2485 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_2559 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_2663 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_2670 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_2795 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_3101 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_3588 | 1 | 1 | 0 | 0 | 0 | 0 |
| src002:smp\_3639 | 1 | 1 | 0 | 0 | 0 | 0 |
| src002:smp\_413 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_4367 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_4412 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_4712 | 1 | 1 | 0 | 0 | 0 | 0 |
| src002:smp\_4727 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_4729 | 1 | 1 | 0 | 0 | 0 | 0 |
| src002:smp\_4914 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_4977 | 1 | 0 | 1 | 0 | 0 | 0 |
| src002:smp\_6028 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_6344 | 1 | 0 | 0 | 0 | 0 | 1 |
| src002:smp\_716 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0151 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0152 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0153 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0154 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0157 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0160 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0161 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0162 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0164 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0167 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0169 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0170 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0171 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0172 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0173 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0175 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0176 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0179 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0182 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0185 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0186 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0187 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0188 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0189 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0191 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0196 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0197 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0199 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_0790 | 1 | 1 | 0 | 0 | 0 | 0 |
| src004:FAMILY\_1036 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_2823 | 1 | 0 | 0 | 0 | 0 | 1 |
| src004:FAMILY\_2927 | 1 | 0 | 0 | 0 | 0 | 1 |
| upstream:anthropics/skills | 2 | 0 | 0 | 0 | 0 | 0 |
| upstream:binance/binance\-skills\-hub | 5 | 0 | 0 | 0 | 0 | 1 |
| upstream:circlefin/skills | 7 | 0 | 0 | 0 | 0 | 0 |
| vendor:fake\-prerequisite\-lure | 3 | 0 | 0 | 0 | 0 | 3 |

## Limits

- Development external evaluation, not a blind holdout or an independent replication\.
- Source\-study malware labels are independent of SkillGate; authenticity to original incident bytes can remain unverified\.
- Complete preserved package snapshots only enter TP/FP/TN/FN; partial packages, errors and missing selected engines remain separate\.
- Official upstream controls with unknown labels do not count as true negatives\.
- Family/source groups are not necessarily independent campaigns\. Model training contamination is unknown\.
- Static package inspection; no acquired scripts, real wallets, malware endpoints or public signed transactions were executed\.
- Runtime prevention is evaluated separately on typed actions\. These inspection scores do not measure prevention\.
