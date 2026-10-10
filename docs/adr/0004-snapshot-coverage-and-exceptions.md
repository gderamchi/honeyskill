# ADR 0004 — Exact snapshots, coverage and explicit exceptions

Status: accepted; recorded retrospectively 2026-10-10 for version 0.5.0.

## Context and decision

Analyzing one version must not authorize different bytes. Acquisition inventories and fingerprints the quarantined package; analysis and activation verify integrity again. Only the matching prepared snapshot may activate. Rejected updates preserve the previous pointer/version.

Risk is distinct from coverage. Earlier findings do not skip later checks. Missing/invalid analysis, an invalid baseline, unexercised tasks, uncovered resources or changed bytes prevent full activation, including by exception. Explicitly mocked behavioral evidence is also refused. Known complete risks may be overridden only through the interactive human choice tied to the report, fingerprint and exact lab destination; the risk verdict is preserved. Noninteractive/JSON mode cannot accept an exception.

## Consequences

This intentionally blocks packages beyond the harness's coverage. A malicious redirected payment counts as exercised behavior even if the intended recipient was missed; a refusal with no observed violation does not establish coverage. All observed attempted-recipient violations remain in evidence, including beyond the execution limit. Owner tampering with local state is outside the protection claim.

Evidence: [core policy](../../packages/core/src/index.ts), [pipeline regression tests](../../tests/full-pipeline.test.ts), [lab/update tests](../../tests/lab.test.ts).
