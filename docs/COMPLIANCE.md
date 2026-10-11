# Regulatory relevance and audit boundaries

This is a design mapping for the hackathon, not legal advice, certification or a claim of compliance. Applicability must be assessed for the deploying entity, its activities and its AI role/risk classification.

| Framework | Relevant control area | HoneySkill contribution | Material gap |
| --- | --- | --- | --- |
| DORA | ICT incident handling and evidence, including Articles 17–19 for in-scope financial entities. | Exact policy decisions, preserved failed analyses, reproducible local effect evidence. | No full incident program, production monitoring, severity classification or regulator-reporting workflow. |
| MiCA | Governance and relevant safeguarding responsibilities for in-scope crypto-asset service providers. | Constrained transaction authority and reviewable action records. | This prototype is not an authorization, licensed service or proof of all CASP controls. |
| AML/CFT | Customer/beneficiary due diligence, risk controls and required transfer information where applicable. | Recipient constraints may enforce a separately approved business policy. | No KYC, sanctions screening, transaction-monitoring program or Travel Rule implementation. Address allowlisting alone is not AML. |
| AI Act | Role/use-case classification; human oversight and logging requirements where applicable, particularly for high-risk systems. | Explicit host authority, local holds and reviewable evidence can support human control. | No legal risk classification, conformity assessment or complete governance system. Financial use alone does not establish high-risk status. |

Primary sources checked on 2026-10-11: [DORA](https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng), [MiCA](https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng), [AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng), [transfer-of-funds / crypto-asset information regulation](https://eur-lex.europa.eu/eli/reg/2023/1113/oj/eng).

An auditor can verify hashes, policy constraints, action decisions and local transaction/state outcomes. An auditor must separately assess legal applicability, organizational controls, system completeness and independent operational evidence. We make no claim that the lab alone satisfies a regulatory obligation.
