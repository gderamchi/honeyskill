# SkillGate security evaluation

2026\-10\-10T23:58:36\.309Z. Development external corpus; static package inspection, not a blind holdout or malware execution.

- Attempted: 20
- TP 0; FN 0; FP 7; TN 12
- Incomplete/excluded: 1; completed unlabelled: 0
- All labels: 0 malicious; 20 benign; 0 unknown
- Conditional recall: N/A; FPR: 36.8%
- Labelled coverage: 19/20 (95.0%)
- Positive coverage: 0/0 (N/A)
- Detection floor (TP / all labelled positives): N/A; excluded cases remain abstentions
- Exclusions: error=0; unsupported=0; partial=1; notRequested=0; missingEngine=0; partialPackage=0; coverageGap=0

## Case index

| Case | Ground truth | Result | Package |
| --- | --- | --- | --- |
| agenttrap\-benign\-0101 — file\-organizer | benign | FP | complete-preserved-snapshot |
| agenttrap\-benign\-0103 — tapestry | benign | FP | complete-preserved-snapshot |
| agenttrap\-benign\-0104 — skill\-creator | benign | FP | complete-preserved-snapshot |
| agenttrap\-benign\-0105 — slack\-gif | benign | FP | complete-preserved-snapshot |
| agenttrap\-benign\-0106 — content\-research\-writer | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-0107 — xlsx | benign | PARTIAL_ANALYSIS | complete-preserved-snapshot |
| agenttrap\-benign\-0109 — webapp\-testing | benign | FP | complete-preserved-snapshot |
| agenttrap\-benign\-0112 — pdf | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-0113 — varlock | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-0114 — mcp\-builder | benign | FP | complete-preserved-snapshot |
| agenttrap\-benign\-0115 — mcp\-builder | benign | FP | complete-preserved-snapshot |
| agenttrap\-benign\-6101 — self\-improving\-agent | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6102 — tavily\-search | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6103 — skill\-creator | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6104 — clawddocs | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6105 — youtube\-watcher | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6106 — baidu\-search | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6107 — model\-usage | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6108 — video\-frames | benign | TN | complete-preserved-snapshot |
| agenttrap\-benign\-6109 — imap\-smtp\-email | benign | TN | complete-preserved-snapshot |

## Family / source groups

These are correlated groups, not independent campaigns. Full grouped matrices are retained in JSON and HTML.

| Group | Attempted | TP | FN | FP | TN | Excluded |
| --- | --- | --- | --- | --- | --- | --- |
| agenttrap:baidu\-search | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:clawddocs | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:content\-research\-writer | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:file\-organizer | 1 | 0 | 0 | 1 | 0 | 0 |
| agenttrap:imap\-smtp\-email | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:mcp\-builder | 2 | 0 | 0 | 2 | 0 | 0 |
| agenttrap:model\-usage | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:pdf | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:self\-improving\-agent | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:skill\-creator | 2 | 0 | 0 | 1 | 1 | 0 |
| agenttrap:slack\-gif | 1 | 0 | 0 | 1 | 0 | 0 |
| agenttrap:tapestry | 1 | 0 | 0 | 1 | 0 | 0 |
| agenttrap:tavily\-search | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:varlock | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:video\-frames | 1 | 0 | 0 | 0 | 1 | 0 |
| agenttrap:webapp\-testing | 1 | 0 | 0 | 1 | 0 | 0 |
| agenttrap:xlsx | 1 | 0 | 0 | 0 | 0 | 1 |
| agenttrap:youtube\-watcher | 1 | 0 | 0 | 0 | 1 | 0 |

## Limits

- Development external evaluation, not a blind holdout or an independent replication\.
- Source\-study malware labels are independent of SkillGate; authenticity to original incident bytes can remain unverified\.
- Complete preserved package snapshots only enter TP/FP/TN/FN; partial packages, errors and missing selected engines remain separate\.
- Official upstream controls with unknown labels do not count as true negatives\.
- Family/source groups are not necessarily independent campaigns\. Model training contamination is unknown\.
- Static package inspection; no acquired scripts, real wallets, malware endpoints or public signed transactions were executed\.
- Runtime prevention is evaluated separately on typed actions\. These inspection scores do not measure prevention\.
