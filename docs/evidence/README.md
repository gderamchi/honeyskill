# Public execution evidence

- `local-validation-0.3.0.json`: current local validation of the shorter install/activation commands, including a real protected Bash session.
- `public-short-install.json`: current 0.3.0 anonymous GitHub shorthand installation, ten real protected-session checks, a fresh public source clone with 45 passing tests and a byte-identical rebuilt CLI. The verification harness uses a short temporary path for macOS IPC sockets.
- `public-short-demo.json`: the complete public demo in a real protected terminal using `npx skills add gderamchi/skill-safe` and `npx skills add gderamchi/skill-trap`: automatic clean installation, risk explanation, cancellation, explicit exception and final installed statuses. The fixture files match the original synthetic corpus.
- `local-validation.json`: historical 0.2.1 validation before publication of the compiled release.
- `benchmark.json`: actual local run against the frozen internal synthetic evaluation corpus; includes failures and false negatives.

- `public-package.json`: historical 0.2.1 anonymous public download, SHA verification, npm installation directly from the release URL, live public demo acquisition and 13 actual PTY scenarios.
- `public-source.json`: historical 0.2.1 anonymous fresh clone, locked install, typecheck, 43 tests, build and native Codex hook smoke with a loopback mock provider. The freshly rebuilt CLI hash matches the released CLI.

All recorded checks passed. The 0.2.1 public-package verification harness was corrected after its source tag to canonicalize macOS /var and /private/var paths; this changed only the verification script, not that released CLI. Raw local reports stay excluded to avoid publishing workstation paths. No paid model, real financial secret or wallet is used.
