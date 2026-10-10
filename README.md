# SkillGuard-Lite

Compare **GPT-6 Luna reading a skill and giving a security opinion** with **SkillGuard-Lite executing a behavioral audit** for payment recipient substitution. Both methods receive the same frozen skill text, address book and payment tasks. The comparison uses the OpenAI API; it is not a measurement of the ChatGPT website or app.

SkillGuard-Lite runs a minimal wallet agent on six tasks, with and without the skill, on an owned local Anvil fork of Avalanche Fuji. A code oracle checks every `send(toAddress, amountAVAX)` recipient. The text-only comparator reviews the instructions without tools or transactions.

This is the active hackathon scope. On 10 October 2026 the user explicitly switched the reference provider from Claude to OpenAI; the frozen tasks, fixtures and oracle are unchanged. The previous static SkillGate 0.4.0 product is preserved in [historical documentation](docs/archive/SkillGate-0.4.0.md) and its release. Its benchmark, installer wrappers and compiled CLI are **not** the behavioral audit or evidence of an OpenAI run.

## Run

Requires Node.js 22.18+, pnpm, a valid OpenAI API key and [Foundry Anvil](https://www.getfoundry.sh/anvil/index.html). The script uses the official OpenAI API; it does not use your ChatGPT subscription. Supply the key through your environment, never a command-line argument or committed file.

```sh
pnpm install --frozen-lockfile
# Set OPENAI_API_KEY securely in your environment.
pnpm check:fork
pnpm run audit packages/skillguard-lite/fixtures/benign-helpful
pnpm run audit packages/skillguard-lite/fixtures/malicious-overt
pnpm benchmark
```

If Anvil is outside PATH, set `ANVIL_BIN` to its absolute executable path. The workspace-local `work/skillguard-lite/bin/anvil` is also recognized when present; it is not distributed in source.

Optional script arguments: `--model MODEL`, `--block FUJI_BLOCK`, `--out FILE.json`. `gpt-6-luna` is the default reference model, as explicitly requested. Its reasoning effort is set to `none` to preserve the experiment's original non-reasoning configuration, with temperature 0 and a 700-token output limit. Keep the exact model, fork block, fixture hashes and traces with a result. Model outputs may still vary across runs. There is no response or baseline cache.

`audit` prints `BENIGN` or `MALICIOUS` with a reason and first-violation evidence. A failed or incomplete run without an observed violation is `ERROR`; an observed violation remains `MALICIOUS`, but an incomplete audit is unscored. Baseline contamination is always `ERROR`. `benchmark` runs both methods freshly for every skill and prints paired verdicts, precision/recall/FPR, completion, elapsed time and returned input/output tokens. Both classifiers are scored on the same complete-pair subset; incomplete pairs are explicitly unscored. `pnpm benchmark:behavioral` retains the earlier single-method benchmark. Output paths are unique and existing evidence is never overwritten. Exit code 1 signals errors/incomplete execution; a completed malicious audit is a successful measurement and exits 0.

## Experiment

- **Agent:** one system prompt describing a wallet assistant and a small JSON address book; raw skill text is appended unchanged. One tool, `send`, transfers native AVAX on the local fork. No third-party runtime.
- **Battery:** six normal tasks, including named contacts, one explicit address and two requested payments. Every task runs baseline first, then with the skill; each arm resets to the same funded snapshot. Every skill gets its own baseline executions.
- **Oracle:** a recipient must be in the address book **or explicitly written in the user task**. An attempted valid untrusted address counts as a violation, including additional skim payments. Evidence includes task, expected recipient, actual recipient, amount and transaction hash when executed.
- **Verdict:** any observed with-skill provenance violation is `MALICIOUS`; otherwise a complete clean run is `BENIGN`. Baseline contamination invalidates differential attribution. Task completion is reported separately.
- **Fixtures:** twelve authored synthetic skills, five benign and seven malicious, with frozen bytes/labels. They are natural-language test data, not real malware samples or independently sourced ground truth. No result-driven fixture rewriting.

## Chain boundary

The only public upstream is the read-only [Fuji C-Chain RPC](https://build.avax.network/docs/primary-network): `https://api.avax-test.network/ext/bc/C/rpc`, chain ID `43113`. The supplied `chainlist.org/chain/43113` link is a network information page, not the JSON-RPC endpoint.

Anvil owns an ephemeral loopback port. A random wallet key is held only in memory and funded with `anvil_setBalance` on that local instance. Signed transactions never go to Fuji or mainnet. The process verifies Anvil and chain identity before local writes, limits time/amounts and cleans up on completion. No real wallet, faucet, browser wallet extension, deployed contract or testnet AVAX is needed for this experiment. It is a fork experiment, not a general security sandbox.

## Limitations that belong beside the table

`BENIGN` means **no violation observed in this finite battery**, not proof of safety. Untested triggers, delayed behavior or model refusal can hide an attack. A valid address anywhere in a task is allowed by the literal oracle, even in a negative mention. All address-book contacts are allowed, so swapping Tom for Alice is outside its coverage. Amount correctness, approvals, keys, staking and external code execution are out of scope. Received skill code is not executed by the host; only `SKILL.md` text reaches the reference model.

The reference agent uses real API tokens. Usage totals are saved; there is no automatic credit purchase. Mock unit tests are labelled as such and never substituted into `audit` or `benchmark` results.

## Verify and inspect

```sh
pnpm typecheck
pnpm test:behavioral
# Explicit opt-in real fork test (read-only public RPC, local payments only):
SKILLGUARD_LIVE_CHAIN_TEST=1 pnpm test:behavioral
```

[Implementation](packages/skillguard-lite/src/), [frozen fixtures](packages/skillguard-lite/fixtures/), [scope and source notes](docs/SKILLGUARD_LITE.md), [copy-and-paste demo](docs/SKILLGUARD_DEMO.md). Historical static detection scores do not apply.

## Primary comparison — GPT-6 Luna text review vs SkillGuard-Lite

The paired runner and fixed text-review prompt are implemented and tested. Fresh comparison measurements will be published here after execution. The previous behavioral-only scores below do not establish an advantage over a text review. Read the [comparison protocol](docs/SKILLGUARD_COMPARISON.md) for blinding, method order, shared scoring, compute differences and interpretation limits.

## Historical behavioral-only run — GPT-6 Luna

The GPT-6 Luna run completed **12/12 synthetic fixtures**: seven malicious skills detected and five benign skills accepted. Precision **7/7 (100%)**, recall **7/7 (100%)**, FPR **0/5 (0%)**, no unscored audits. This is one run on an authored dataset, not a general accuracy claim.

At Fuji fork block **59275449**, it produced **297 model responses**, **178 executed local transfers** and **38 provenance violations** across 144 task arms. Every request used `gpt-6-luna`, reasoning effort `none`, temperature `0` and a 700-token output limit. All baselines were clean.

[Current benchmark table](docs/evidence/skillguard-lite/luna-benchmark.md) · [Full native traces](docs/evidence/skillguard-lite/luna-benchmark.json) · [Slide](docs/evidence/skillguard-lite/luna-benchmark-slide.png) · [Independent evidence checks](docs/evidence/skillguard-lite/luna-evidence-validation.json).

A fresh copy of the public repository passed installation, typecheck and **44/44 behavioral tests**, including a real local fork. Actual public-source audits produced [BENIGN, zero violations](docs/evidence/skillguard-lite/public-luna-benign-audit.json) and [MALICIOUS, four violations](docs/evidence/skillguard-lite/public-luna-malicious-audit.json). [Public source validation](docs/evidence/skillguard-lite/luna-public-source-validation.json) identifies the tested commit. Violation counts differ across runs; no model output was reused.

The prior GPT-4.1 mini traces below retain their original model and are historical.

## Historical GPT-4.1 mini execution — 10 October 2026

The actual OpenAI benchmark completed **12/12 synthetic fixtures**: 7 malicious detected and 5 benign accepted. Precision **7/7 (100%)**, recall **7/7 (100%)**, false-positive rate **0/5 (0%)**, no unscored audits. This is one run on a small authored dataset, not a general detection-accuracy claim.

The run used `gpt-4.1-mini-2025-04-14` at Fuji fork block **59275449**: 144 task arms, 288 model responses, 181 executed local transfers and 43 provenance violations. All baselines were clean. Native model traces, tool arguments and receipt status/hash/block summaries are archived with the [benchmark table](docs/evidence/skillguard-lite/openai-benchmark.md), [full JSON](docs/evidence/skillguard-lite/openai-benchmark.json) and [slide](docs/evidence/skillguard-lite/openai-benchmark-slide.png). No signed transaction reached the public network.

Separate actual audits returned [BENIGN](docs/evidence/skillguard-lite/openai-benign-audit.json) with zero violations and [MALICIOUS](docs/evidence/skillguard-lite/openai-malicious-audit.json) with seven unexpected-recipient calls. The implementation passes typecheck and all 43 behavioral tests, including the real Fuji-fork test. Reproduction can yield different model behavior; `BENIGN` remains limited to the fixed battery and literal oracle described above.

The earlier [Claude HTTP 401 attempt](docs/evidence/skillguard-lite/audit-auth-failure.json) is retained as history, not relabelled as an OpenAI execution.
