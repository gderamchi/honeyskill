# First live security-v1 development evaluation

Run: `live-2026-10-11T03-31-31-569Z`, 2026-10-11 03:31:31–03:36:52 UTC. Local `0.6.0-dev.0`, published 0.5.0 unchanged. [Readable report](index.html), [all 114 cases](cases.html), [portable case index](case-results.json).

**The live integration works, but detection remains insufficient.** This is one preserved development run, not an unseen holdout or evidence of general security effectiveness.

## Results

| Population | Total | Confusion matrix | Outside matrix |
| --- | ---: | --- | --- |
| External source-labelled malicious packages | 80 | TP 10 / FN 22 | 48 incomplete |
| Constructed AgentTrap benign research controls | 20 | FP 4 / TN 12 | 4 unsupported |
| Official controls with unknown labels | 14 | Not scored | 12 completed unknown, 2 incomplete |

Positive coverage: 32/80 = 40%. Conditional recall: 10/32 = 31.25%. Observed detection floor: 10/80 = 12.5%. Conditional research-control FPR: 4/16 = 25%; this is not an in-the-wild estimate. No universal accuracy or precision score is claimed across these differently selected populations. The 32 eligible positives consist of 31 SRC002 and one SRC004 case, a substantial coverage bias.

On exactly the same 32 positive and 16 negative rows:

| Method | TP | FN | FP | TN |
| --- | ---: | ---: | ---: | ---: |
| Native | 3 | 29 | 0 | 16 |
| Cisco | 7 | 25 | 4 | 12 |
| Semantic | 5 | 27 | 0 | 16 |
| Native + Cisco | 7 | 25 | 4 | 12 |
| Native + Cisco + semantic | 10 | 22 | 4 | 12 |

The LLM adds alerts for `sqlite-agent-amplification`, `jetaasc-newsletter` and `weekly-plan`. This is agreement with external labels; task-aware human adjudication is still needed to validate the proposed threat mechanisms. Exact source citations alone do not establish malicious intent. There is **no demonstrated false-positive reduction**: the previous offline 7/19 FP becomes 4/16 because three previously flagged controls exceed the semantic content cap. Paired FP remains four.

Combined primary exclusions across 114 cases: unsupported 15, partial analysis 14, partial source package 24, coverage gap one, error zero. Underlying causes can overlap. All 15 unsupported semantic stages exceed the existing 64 KiB cap and made no API request. Of 99 actual inspection responses, 98 semantic stages completed and `src004-asb04-002949` remained partial because a finding failed exact file/line citation validation. No cap, threshold, detector or citation rule was changed during or after this measurement.

## Live model and chain evidence

Six authored synthetic guarded cases (three benign/adversarial pairs) produced six exact simulated native AVAX payments. There were **zero unauthorized proposals, zero unauthorized effects and zero monitor interceptions**. Twelve actual model responses establish working integration and utility for these cases; no unguarded comparator or causal prevention gain was measured. [Guarded evidence](guarded/summary.json).

A separate fresh owned-Anvil chain proof passed all 16 state/receipt assertions: four unauthorized synthetic proposals were denied without dispatch; one exact 0.001 local-test-ETH transfer mined on chain 31337. This was separate from the simulated model payments. [Chain proof](chain-proof.json), [independent saved-data audit](guarded-audit.json).

## Provenance and verification

- GPT-6 Luna, reasoning none, one repetition, zero automatic retries. [Frozen protocol](protocol.json).
- 111 unique response IDs: 99 inspection + 12 guarded. Returned usage: 767,520 input + 6,565 output = 774,085 tokens. These records are not an independently verified invoice.
- Source freeze `0b40338c6dcee29e3e234f6c966f677b3e8e5d97510ea88e3a3fdb4af19ddcf2` matches the prior offline run and all 21 current source files. All 616 corpus fixtures match pinned hashes; native/Cisco findings and input fingerprints match offline evidence.
- Both product metric verifiers pass. A separate read-only implementation recomputed matrix counts and exact paired cohorts. [Inspection audit](inspection-audit.json).
- A separate checker passed 74 guarded/chain consistency checks, including all 16 chain assertions. This verifies saved evidence, not independent provider or node attestation.
- HTML was checked in actual headless Chromium at 320 and 1280 pixels: 114 case details, valid local links, no page errors, no external requests or page overflow. [Report validation](report-validation.json).

The portable case index is an explicit structural projection: it preserves IDs, labels, provenance, source hashes, engine rules/severities, source coordinates, response IDs and usage. Hostile excerpts, arbitrary explanations and original annotations are omitted because source content can include credential-like strings. Full private local evidence remains in the run directory, identified by per-case SHA-256. Do not call this projection raw evidence. The synthetic guarded records and local-chain record contain only test actions and ephemeral public addresses.

The user supplied the API key through masked terminal input for the finished process; it was not persisted. No acquired script execution, real wallet, public transaction, real-profile activation or publication occurred. Earlier unit/build/package checks were not rerun for this measurement. The prior offline evidence remains unchanged.

Outstanding: independently adjudicated task-aware labels, a family-disjoint unseen holdout, broader supported package coverage, successful runtime attack witnesses and validated real-effect adapters beyond native sends. No result establishes prevention of a real blockchain-malware campaign.
