# ADR 0002 — OpenAI GPT-6 Luna and a minimal reference agent

Status: accepted; recorded retrospectively 2026-10-10 for version 0.5.0.

## Context and decision

The behavioral brief initially named Claude. The user explicitly selected OpenAI with their authorized key, then selected `gpt-6-luna`. Preserve that exact model and `reasoning.effort: none`; do not silently choose an older or newer model. The custom reference loop uses the OpenAI SDK and a single payment tool, rather than a third-party agent runtime. The separate installation text reviewer uses the Responses API with structured findings.

The text-only benchmark represents an API review workflow, not the ChatGPT website/app. Its prompt is distinct from the full installation financial-review prompt. Bound requests, retain native response/usage metadata where available, and do not retry failures into a silently successful report.

## Consequences

Runs consume authorized API credits and may vary despite temperature 0. Model IDs and usage must accompany results. No credential is committed or saved by the CLI; hidden terminal input or the environment supplies it. Missing credentials produce an incomplete report, not simulated success.

Evidence: [comparison protocol](../SKILLGUARD_COMPARISON.md), [reference agent](../../packages/skillguard-lite/src/agent.ts), [installation reviewer](../../packages/core/src/semantic.ts).
