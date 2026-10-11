# HoneySkill — hackathon development update

Updated 11 October 2026. The user requested the HoneySkill name, honey-jar identity, realistic controlled payment scenarios and the Secure Horizons Track 1 submission package. This is a development delivery, not a claim that every security research limitation has been resolved.

## Product

Primary CLI: `honeyskill`. Package: `@gderamchi/honeyskill`, version `0.6.0-dev.1`. Existing storage and schema identifiers remain stable. The previous v0.5.0 release and its historical evidence remain available. Root README covers the active product; the earlier-overview file preserves the previous workflow.

`honeyskill payment-demo --out outputs/payment-demo` runs four authored scenarios: checkout, settlement routing, service fee, wallet approval. Source fixture instructions are inert; an author-scripted replay supplies six typed proposals. The same proposals run from identical owned-local snapshots, with direct execution versus the financial monitor. This is separate from `try` and from every frozen inspection or model benchmark.

## Recorded execution

An actual owned Anvil Fuji fork used chain 43113 at public source block 59295998, hash `0x9de126afc7f96b44e03d56bf69d0084a483af05285d9177e511f1ffa8286e0ec`. Source block identity was checked against the initial local fork. Signed transactions remained local. Four scenarios, six actions, 36/36 consistency checks. Unauthorized effects: 3 direct versus 0 guarded. Exact legitimate payments: 3 versus 3. Action-level TP 3, TN 3, FP 0, FN 0. The recipient-substitution scenario is held and the fixed replay does not recover its payment. Approval uses a minimal allowance-storage witness, not an ERC-20 integration.

Zero model calls. Pure policy timing discloses 200 warmups and 2,000 repetitions per action; it excludes RPC, mining and model time. There is no measured normal-AI comparator. A prospective paired model protocol is in `public-demo/PAIRED_MODEL_PROTOCOL.md`; it has not been run. No new API credential was requested or recovered for this delivery.

## Evidence boundaries

The separate 114-case inspection development evaluation remains 18 TP / 14 FN / 48 incomplete positives, 7 FP / 12 TN / 1 incomplete constructed control, and 14 unknown-label cases separately accounted for. Do not replace these results with the six-action demonstration. Do not publish the unresolved-rights third-party corpus. New public demo fixtures have neutral professional names and explicit authored provenance in their manifest and README.

## Submission requirements

Verified [candidate guide](https://app.notion.com/p/Candidate-Guide-Track-Guidance-EN-3f400920c77e81beb3b4fad01fc5eeda) and [Track 1](https://app.notion.com/p/Track-1-Fintech-Security-Guardians-of-Value-3f400920c77e81df8aadffed9ec48ff1). Deadline Sunday noon; first pitch 5 minutes plus 2 Q&A, final 3 minutes plus 3 Q&A. Required: accessible repository, 2–3 minute demo video, recommended maximum 8-slide deck, one-page defense sheet, working incident PoC, response playbook and compliance slide. Synthetic and replayed scenarios are explicitly allowed. Team supplied by the user: Ismael Meguenni, Guillaume Deramchi, Allan Debert — 42. No invented roles.

Product capability, public availability and actual external submission must be reported separately. A prepared dossier does not mean an organizer received it. Local artifact paths and raw logs must not appear in a public submission.

Recorded artifacts: [interactive payment proof](evidence/honeyskill-demo/payment-demo.html), [native JSON](evidence/honeyskill-demo/evidence/payment-demo.json), and [independent consistency recomputation](evidence/honeyskill-demo/evidence/independent-validation.json). The latter checks exported data; it is not third-party attestation.

## Persistent Codex setup, 11 October 2026

`honeyskill setup --agent codex` now configures the native project hook by default, pins the compiled installer and preserves optional terminal activation. Codex requires initial `/hooks` trust; later sessions use the same configured hook. Static/hybrid installation coverage and host failure boundaries are documented in [PERSISTENT_CODEX_SETUP](PERSISTENT_CODEX_SETUP.md). Full `try` remains lab-only; historical benchmarks are unchanged.
