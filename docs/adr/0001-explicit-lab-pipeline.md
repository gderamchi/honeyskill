# ADR 0001 — Explicit full-pipeline installation lab

Status: accepted; recorded retrospectively 2026-10-10 for version 0.5.0.

## Context and decision

The project evolved from static installation protection to a behavioral experiment, then the user explicitly requested one command that combines regex, LLM, execution and reporting in a simple test environment. Keep the product name SkillGate. `skillgate try <source>` orchestrates all three checks on the same quarantined copy and saves a unified report before any activation. No web application is required.

Activation is allowed only inside a dedicated directory bearing a validated lab marker. The user's actual agent profile and the development repository are not targets. Historical `on`/`install` functionality remains preserved but does not claim to run the full new pipeline or intercept arbitrary terminal commands.

## Consequences

The trial is easy to invoke and can be tested without changing real agent state. This is explicitly a lab product; extending it into a real runtime or universal installer interception is a separate decision. The frozen behavioral benchmark remains independently callable.

Evidence: [lab specification](../SKILLGATE_LAB.md), [command implementation](../../apps/cli/src/lab.ts), [release validation](../evidence/skillgate-lab/report.md).
