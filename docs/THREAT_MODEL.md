# HoneySkill threat model and limits

HoneySkill addresses two related but distinct risks: a skill package can contain misleading instructions or suspicious supporting files, and an agent can propose a financial action that exceeds a user's explicit authorization. Inspection and transaction mediation have separate evidence and coverage.

## Assets and adversary

Assets include private keys held by the host wallet, funds, token approvals, recipient identity, transaction fees and the integrity of the user's payment intent. The adversary may control skill text, linked repository content or a model-generated action proposal. The model and skill are not trusted to define or widen the authorization policy.

## Inspection boundary

HoneySkill acquires a package into quarantine, records a snapshot and applies native checks, an optional pinned Cisco Skill Scanner profile and a modular semantic review. Acquired code, hooks and dependency installers are not executed. Coverage errors, unsupported files and incomplete model responses remain visible; incomplete analysis is not a clean result. A matching fingerprint establishes byte identity, not verdict correctness or package safety.

Inspection can miss obfuscation, indirect behavior, unsupported formats, new attack patterns and behavior that requires execution. The imported malicious labels are external attributions, not independent adjudications. The current development corpus has informed tuning and is not an unseen holdout.

## Action-mediation boundary

The financial monitor validates typed proposals against trusted host policy before dispatch through its configured adapter. The controlled demo exercised four authored scenarios and six native-send or minimal allowance-witness proposals on an owned local chain. It is not a production wallet integration. It does not protect actions sent through another adapter, direct wallet access, shell or arbitrary scripts. The demonstrated approval check is a local storage witness, not a complete ERC-20 implementation. The fixed recipient-substitution scenario is held; the replay does not replan.

Policy correctness, complete mediation and adapter integrity are trust assumptions. An attacker who can change the trusted policy or route around the adapter can invalidate the control. A denied or simulated action is not proof against every real agent attack.

## Operator and data risks

LLM review may send skill text to the configured provider when the operator explicitly enables that stage; apparent-secret redaction is heuristic. Use public or otherwise non-secret samples. Reports may contain excerpts, filenames, public source links, hashes and local decisions, and should be reviewed before sharing. Local records are editable by the operating-system account owner.

An explicit exception keeps the original findings visible and applies only to the exact analyzed snapshot and destination. It is not proof of human identity and does not cover later versions. HoneySkill cannot revoke a key, recover funds, reverse a public transaction or remediate a host after exposure.

## Evaluation limits

The local payment replay and package-inspection benchmark measure different units. The former uses six scripted actions; the latter contains external malicious labels, constructed controls and unknown cases with incomplete outcomes. Neither establishes universal detection, real-world attack prevention, production safety or comparative cost and accuracy against a normal AI system.
