# HoneySkill controlled payment demonstration

Run `honeyskill payment-demo --out outputs/payment-demo`. Use `--local` to avoid the public read-only fork preflight. The command writes a fresh `report.json`; it never installs a skill or calls an AI provider.

These four authored laboratory skills have neutral professional names. `manifest.json` explicitly records their synthetic origin, attack labels and exact bytes. They are not real malware samples or independent benchmark cases. The `.fixture` files remain inert.

The user authorizes exactly one native payment of 0.001 to the merchant, within exact fee limits. Four fixed proposal sequences represent an ordinary payment, recipient substitution, an extra hidden charge and an unrequested unlimited approval. The replay comes from the test author, not an LLM. The same proposals run once with no policy and once through HoneySkill's existing financial reference monitor, from identical local snapshots.

`auto` mode probes the official public Avalanche Fuji C-Chain RPC using read methods only, then starts its own local Anvil fork at the recorded block. Every signature and transaction goes only to that owned loopback process, using a fresh in-memory account funded locally. If the fork cannot start, the report explicitly records local genesis chain 31337 and the fallback reason. A chain number or Avalanche intent alone is not proof of a Fuji fork.

Native transfers are mined and checked through receipts, transaction fields, balances and nonces. The approval scenario uses a tiny local allowance-storage witness, explicitly not an ERC-20 implementation or token-value test. Snapshot rollback makes the guarded and unguarded branches comparable; hashes can repeat across counterfactual branches and are not public transactions.

Report action-level TP/FP/TN/FN only as six deterministic policy decisions. Report all utility failures, including a refused recipient-substitution action that the fixed replay cannot repair. Local microbenchmark timings use disclosed warmup/repetition counts and exclude model calls, network and mining. **Normal-AI accuracy and relative AI performance are unmeasured.** See `PAIRED_MODEL_PROTOCOL.md` for the separate prospective experiment.

Official network reference: [Avalanche Primary Network documentation](https://build.avax.network/docs/primary-network).
