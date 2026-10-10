# Threat model and limits

An adversary supplies misleading skill instructions, scripts or supporting files that could misuse financial access available to the host agent. SkillGate does not inspect real wallets, secrets, balances or accounts.

## Controlled boundary

Checked installations and updates flow through SkillGate, directly or through supported wrappers. Manual copies, other installers, absolute binaries bypassing wrappers, post-install changes and processes with the same user's privileges remain outside this boundary. A terminal choice is not cryptographic proof of human presence.

## Invariants

- Never execute acquired scripts, hooks or dependency installers, or follow arbitrary links found in skill content.
- Reject links, special files, unsafe paths and malformed or excessive archives.
- Analyze the collected bytes in quarantine outside the active skill directory; verify their fingerprint again before activation.
- Preserve the active version when an update is held or fails.
- Never auto-install after incomplete analysis or a failed required provider.
- Treat source excerpts as evidence, never instructions to the scanner.

## Acquisition

Sources are local directories or public HTTPS GitHub repositories, optionally selecting a revision and subdirectory. GitHub uses public Git ref resolution and a SHA-pinned codeload archive, without REST API calls or credentials. URLs are restricted; unsafe archive entries and unsupported formats fail closed. Local archive paths remain unsupported.

Network operations have deadlines. Archives are capped at 8 MiB compressed, 32 MiB expanded and 4096 entries. Selected packages retain limits of 256 files, 2 MiB total, 256 KiB per file and depth 12. A large repository may be rejected even if the desired skill is small. No failure falls back to an upstream skill installer.

Removing REST calls avoids the anonymous REST quota encountered in 0.3.1. Git transport and codeload may still fail or throttle requests; errors must leave the skill inactive.

## Detection limits

The engine uses finite text heuristics. It does not prove complete program data flow, decode every obfuscation or run a dynamic sandbox. Paraphrases, unsupported languages, aliases and indirect behavior may evade it. Negations and defensive quotations require local context; a skill's claim of approval or educational purpose is not trusted authorization.

`complete_for_supported_checks` means supported checks read the package within their limits. It is not a safety certificate. An address alone does not prove malicious intent; severity is not a calibrated probability. A requested broad spending approval may be legitimate and still carry financial risk.

The original frozen benchmark has already informed development. Improvement on it is a regression measurement, not a fresh blind test. Additional challenge cases are synthetic and authored within the same team. Misses, false positives and acquisition errors remain visible.

The optional model provider requires explicit consent and configuration. Apparent-secret redaction is imperfect. Mock tests do not establish detection quality with a real model; no paid provider execution is implied.

## After activation

SkillGate cannot revoke keys, recover funds, roll back transactions or constrain an installed skill. A missed threat or an accepted exception may still cause harm within host permissions. Keeping an older snapshot does not reverse an activated version's actions.

Local reports and logs are not tamper-proof against the OS account owner. No telemetry, remote database, wallet or transaction firewall is part of this product.
