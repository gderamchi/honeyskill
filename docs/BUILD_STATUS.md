> Historical status: SkillGate 0.4.0 only. Statements below about unexecuted model/Fuji work and provider usage describe that earlier release. For the delivered 0.5.0 pipeline and actual executions, read [PROJECT_STATE.md](PROJECT_STATE.md) and [HANDOFF.md](HANDOFF.md).

# SkillGate 0.4.0

Updated 10 October 2026. CLI-only financial-risk checks before skill installation, with English messages and a protected terminal session.

## Implementation

- Static detection now normalizes Unicode for matching, joins adjacent instructions, follows simple secret variables/containers across files, and distinguishes local prohibitions, rejected examples, report delivery and allowance revocation. Original evidence remains unchanged.
- GitHub acquisition resolves refs through anonymous Git and downloads an immutable codeload archive. No REST API, credentials or quota token. Bounds apply to time, compressed/expanded bytes, archive entries and selected skill contents. Links, unsafe paths, unsupported metadata and submodules are refused. Deadline, output overflow and subprocess failure terminate the Git process group.
- Only the verified snapshot can activate. Findings and incomplete coverage require review; cancellation remains the default, and explicit exceptions are recorded. Rejected updates preserve the previous active snapshot.
- `skillgate on` activates wrappers for supported npx/pnpm/skills commands within a dedicated Bash session. Unsupported or ambiguous installation modes are rejected. No global shell profile, wallet or transaction firewall is installed.

## Detection evidence

The original 40 frozen cases are unchanged. [Regression comparison](evidence/detection-comparison-0.4.0.json): 11/16 → 16/16 suspect cases with findings; 4/16 → 0/16 legitimate cases with findings; 11/16 → 15/16 legitimate automatic-installation decisions. Seven incomplete cases remain held; the eighth keeps its existing acquisition error and activates nothing. One legitimate case requires review because remote instructions are unresolved.

The [additional 16-case challenge](evidence/challenge-comparison-0.4.0.json) preserves baseline, first-candidate and post-feedback results. Before failure disclosure, findings rose from 2/8 to 5/8 suspects, while false positives fell from 3/8 to 2/8. The final post-feedback rerun records 8/8 and 0/8 respectively. This last score follows tuning and review; it is not a fresh blind measurement. Both datasets are authored, synthetic and internal, with no independent information barrier or production accuracy claim.

## Verification status

[Local 0.4.0 validation](evidence/local-validation-0.4.0.json) passed typecheck, **85 tests**, 13 terminal decision flows, 10 protected-session checks, seven packaged interception cases, build, isolated simulation and package installation. [Real GitHub acquisition](evidence/github-acquisition-0.4.0.json) passed eight HEAD/SHA downloads with exact known fingerprints and no REST calls or credentials. Timeout cleanup was tested with a stalled real Git HTTP connection and left no network helpers running. [Anonymous public installation](evidence/public-short-install-0.4.0.json) passed with a fresh public clone, 85 passing tests, ten terminal checks and a byte-identical source rebuild. The [new English terminal video](evidence/english-terminal-video-0.4.0.json) is 51.1 seconds in 1080p and shows the exact public safe/trap commands, automatic installation, cancellation, then explicit exception. All three acquisitions use GitHub through the new CLI path; there is no local-clone fallback. Full decode and four key-frame visual checks passed. Historical evidence remains available under its original version.

## Remaining boundaries

- Git/codeload can still fail or throttle. Removing REST API calls does not eliminate every GitHub service limit.
- Static heuristics are incomplete and are not safety certification. Large or unsupported archives are refused.
- Manual copies, absolute executables bypassing PATH wrappers, unrelated installers and processes without the protected environment remain outside scope. Transactions after installation are not controlled.
- The optional Codex hook requires native trust and write permission. Earlier integration evidence used the real CLI with a simulated local model; hook startup failure or timeout can fail open. No real paid provider or universal agent integration is claimed.
- Real-model, Cisco comparison and Fuji transaction runs remain unexecuted. Hackathon track alignment and common official deliverables still need organizer confirmation.

## Historical releases

[0.3.1 local validation](evidence/local-validation-0.3.1.json), [anonymous public installation](evidence/public-short-install-0.3.1.json) and [English video](evidence/english-terminal-video-0.3.1.json) remain intact. That video used verified local Git clones after a REST HTTP 403 quota failure. It must not be presented as proof of the new public acquisition path.

The [0.3.0 public demonstration](evidence/public-short-demo.json), [0.2.1 package](evidence/public-package.json), [source rebuild](evidence/public-source.json) and original [benchmark](evidence/benchmark.json) are historical evidence. Archived web source is excluded from the shipped package.

All test activations use temporary projects. No demonstration skill was activated in this development repository or real user profile. No acquired skill code, real wallet, financial secret, real funds or paid provider was used. Raw workstation logs and temporary paths remain excluded from publication.
