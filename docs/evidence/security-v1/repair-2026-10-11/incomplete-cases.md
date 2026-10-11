# Baseline incomplete-case audit

All 48 incomplete malicious-labelled cases from the first live development run. This is a diagnostic audit, not an independent holdout.

## Counts

Primary mutually exclusive exclusions: {'partial': 13, 'unsupported': 10, 'partialPackage': 24, 'coverageGap': 1}.

Overlapping causes (do not sum): {'partial-source-package': 36, 'cisco-partial': 11, 'cisco-strict-manifest-fallback': 5, 'native-extension-coverage': 8, 'cisco-secret-redaction-contract': 1, 'semantic-content-limit': 10, 'cisco-source-coordinate-contract': 5, 'semantic-evidence-contract': 1, 'outside-skill-root': 1}.

## Actions and boundaries

- Never alter corpus, source labels, or package completeness.
- Partial source snapshots remain incomplete even when every retained file is inspected.
- Keep real Cisco strict-manifest loader failures incomplete; do not invent frontmatter or switch to lenient loading.
- Validate Cisco secret redactions against exact source line and code-point offsets without emitting original secrets.
- Reconstruct documented Cisco primary-body and Python-block coordinates and verify exact excerpts. Unresolved repeated pipeline coordinates remain incomplete.
- Native extension coverage and semantic request size are assigned to the root agent.
- Unsupported or incomplete is not a false negative; alerts may coexist with incomplete results.

## All 48 cases

| ID | Skill | Primary exclusion | Overlapping causes |
| --- | --- | --- | --- |
| src002-asb04-002790 | notion-export | partial | partial-source-package, cisco-partial, cisco-strict-manifest-fallback |
| src002-asb04-005215 | database | partial | native-extension-coverage, cisco-partial, cisco-secret-redaction-contract |
| src002-asb04-003205 | pptx | unsupported | native-extension-coverage, semantic-content-limit |
| src002-asb04-002010 | test-strategy | partial | cisco-partial, cisco-strict-manifest-fallback |
| src002-asb04-002647 | e2e-validator | partial | cisco-partial, cisco-strict-manifest-fallback |
| src002-asb04-004548 | hacs | unsupported | cisco-partial, cisco-source-coordinate-contract, semantic-content-limit |
| src002-asb04-003376 | context7 | partialPackage | partial-source-package |
| src002-asb04-000511 | pptx | unsupported | partial-source-package, native-extension-coverage, semantic-content-limit |
| src002-asb04-005375 | email | unsupported | native-extension-coverage, semantic-content-limit |
| src002-asb04-000757 | setup-claude-skills-for-web | partial | cisco-partial, cisco-source-coordinate-contract |
| src002-asb04-004252 | page | partial | cisco-partial, cisco-strict-manifest-fallback |
| src002-asb04-004922 | slack-bridge | partial | native-extension-coverage |
| src002-asb04-004098 | chrome-devtools | unsupported | native-extension-coverage, semantic-content-limit |
| src002-asb04-004620 | stealth-ops | partial | cisco-partial, cisco-strict-manifest-fallback |
| src004-asb04-002011 | arbitrum-dapp-skill | unsupported | partial-source-package, native-extension-coverage, semantic-content-limit |
| src004-asb04-002949 | nervepay | partial | partial-source-package, semantic-evidence-contract |
| src004-asb04-004339 | polymarket-btc15m | unsupported | partial-source-package, semantic-content-limit |
| src004-asb04-006555 | x402_payment_tron | partialPackage | partial-source-package |
| src004-asb04-006438 | bird | partialPackage | partial-source-package |
| src004-asb04-001045 | bomb-dog-sniff | unsupported | partial-source-package, semantic-content-limit |
| src004-asb04-002179 | skillguard | unsupported | partial-source-package, semantic-content-limit |
| src004-asb04-003082 | nano-banana-antigravity | partialPackage | partial-source-package |
| src004-asb04-000952 | secure-sync | partialPackage | partial-source-package |
| src004-asb04-003022 | devinism | partialPackage | partial-source-package |
| src004-asb04-005884 | cron-writer | partialPackage | partial-source-package |
| src004-asb04-006923 | dsiprouter | unsupported | partial-source-package, semantic-content-limit |
| src004-asb04-006263 | excel | partialPackage | partial-source-package |
| src004-asb04-003128 | govpredict-ai | partialPackage | partial-source-package |
| src004-asb04-001417 | antigravity-image | partialPackage | partial-source-package |
| src004-asb04-003288 | better-polymarket | partialPackage | partial-source-package |
| src004-asb04-003427 | moltiverse-among | partial | partial-source-package, cisco-partial, cisco-source-coordinate-contract |
| src004-asb04-006033 | linkedin | partialPackage | partial-source-package |
| src004-asb04-005298 | molt-security-auditor-v3 | partialPackage | partial-source-package |
| src004-asb04-005622 | moltbook | partialPackage | partial-source-package |
| src004-asb04-000233 | totally-legit-skill | partialPackage | partial-source-package |
| src004-asb04-003303 | twitter-openclaw-2 | partial | partial-source-package, native-extension-coverage |
| src004-asb04-000893 | gmail-client-PM | coverageGap | outside-skill-root |
| src004-asb04-004884 | query-optimizer | partialPackage | partial-source-package |
| src004-asb04-006358 | recruitment | partialPackage | partial-source-package |
| src004-asb04-002076 | reddit-trends | partial | partial-source-package, cisco-partial, cisco-source-coordinate-contract |
| src004-asb04-004950 | openclaw-watchdog | partialPackage | partial-source-package |
| src004-asb04-003932 | wed | partialPackage | partial-source-package |
| src004-asb04-003548 | deep-research | partialPackage | partial-source-package |
| src004-asb04-006380 | wacli | partialPackage | partial-source-package |
| src004-asb04-004116 | youtube-watcher | partialPackage | partial-source-package |
| vendor-twitter-sum | twitter-sum | partialPackage | partial-source-package |
| vendor-sundial-bybit | bybit-trading | partial | partial-source-package, cisco-partial, cisco-source-coordinate-contract |
| vendor-google-qx4 | google-qx4 | partialPackage | partial-source-package |

## Cisco repair validation

Actual pinned Cisco was rerun on all 11 previously partial Cisco stages. Three now complete: database, hacs, and moltiverse-among. Eight remain incomplete: five genuine manifest loader failures and three repeated pipeline snippets whose source coordinates remain ambiguous. Moltiverse-among remains an incomplete source package, so a repaired Cisco stage cannot make it eligible. No acquired code ran.

The adapter validates Cisco-secret redaction at exact source lines and Python code-point offsets, reconstructs known primary-body YARA coordinates and Python Markdown-block coordinates, and verifies the exact source quotation. Upstream redaction is preserved, not reversed in reports.

Validation: 17/17 Cisco contract tests including a real pinned-scanner inert fixture; typecheck passed. No paid requests. See `cisco-repair-validation.json`, `cisco-diagnose.json`, and `cisco-diagnose-after.json`.
