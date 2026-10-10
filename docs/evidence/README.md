# Public execution evidence

- `local-validation.json`: actual validation before publication of the compiled release.
- `benchmark.json`: actual local run against the frozen internal synthetic evaluation corpus; includes failures and false negatives.

- `public-package.json`: anonymous public download, SHA verification, npm installation directly from the release URL, live public demo acquisition and 13 actual PTY scenarios.
- `public-source.json`: anonymous fresh clone, locked install, typecheck, 43 tests, build and native Codex hook smoke with a loopback mock provider. The freshly rebuilt CLI hash matches the released CLI.

All recorded checks passed. The extra public-package verification harness was corrected after the source tag to canonicalize macOS /var and /private/var paths; this changed only the verification script, not the released CLI. Raw local reports stay excluded to avoid publishing workstation paths. No paid model, real financial secret or wallet is used.
