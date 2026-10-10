# ADR 0006 — Standalone CLI and separate public/private evidence

Status: accepted; recorded retrospectively 2026-10-10 for version 0.5.0.

## Context and decision

Ship the compiled TypeScript CLI plus task/address-book data, inert demo fixtures and bundled dependency licenses. Commit `dist/` in the public GitHub package and provide a release archive. Do not add root scripts named `build`, `prepare`, `prepack` or `install`, which would cause npm Git installs to rebuild; source builds use `build:cli`. No web server, install hook or third-party skill code is executed during installation.

Public GitHub acquisition resolves immutable revisions with Git/codeload under bounds; do not depend on a REST quota token. Public package downloads can still slow down or fail. A pinned release and compiled archive provide reproducible alternatives. Anvil must come from explicit/trusted user installation locations, never an executable planted in the inspected working directory.

Publish only reviewed summaries and source. Keep raw local traces, workstation paths, operator identity, credentials and private account data out of commits. Reports are private local files by default and may need redaction before sharing.

## Consequences

Source changes require an explicit build and packaged/public verification before release claims. Installing the public package is a distinct proof from source tests. Preserve the released artifact rather than overwriting its historical evidence with new measurements.

Evidence: [build](../../scripts/build.mjs), [offline package smoke](../../scripts/smoke-package.mjs), [Anvil resolution](../../packages/skillguard-lite/src/prerequisites.ts), [public byte verification](../evidence/skillgate-lab/public-install.json).
