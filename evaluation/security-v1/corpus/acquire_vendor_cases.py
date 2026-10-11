#!/usr/bin/env python3
"""Fetch three named incident-linked skill texts as data, never their payloads."""
import hashlib
import json
from collections import Counter
from pathlib import Path
from acquire_controls import get
from build_corpus import omit_reason, write_inert

CASES = [
    {'id': 'vendor-twitter-sum', 'name': 'twitter-sum', 'repository': 'Sompote/Tiger_bot', 'commit': 'cf1e0903a8acee08c4bcea7ac8b7da757e464e26', 'path': 'skills/twitter-sum/SKILL.md', 'sha256': '66273fae2360d0f21ab4bfa67a18603924d871ce8eb0879de6682d143afb0e8f', 'documentationUrl': 'https://github.com/snyk-labs/toxicskills-goof/blob/80ce2e06f52fd384163c4bd6778676019723773c/README.md', 'sourceDate': None, 'basis': 'Snyk Labs incident demonstration repository directly links this exact pinned public artifact as a malicious skill.', 'versionCaveat': 'Exact vendor-linked artifact verified; no victim compromise at this commit asserted.', 'license': 'Repository LICENSE contains MIT text, but ownership of incorporated third-party skill content is not independently established.'},
    {'id': 'vendor-sundial-bybit', 'name': 'bybit-trading', 'repository': 'sundial-org/awesome-openclaw-skills', 'commit': 'b80cde2ef85241dd4fd54a1b934f5e22835f78ba', 'path': 'skills/bybit-trading/SKILL.md', 'sha256': '34905cc8ff3c5ce92f59b281f4fc4559a2d701e75ebb3be8a2f2c5493993e15d', 'documentationUrl': 'https://www.venustech.com.cn/new_type/gjywxfx/20260311/29211.html', 'sourceDate': '2026-03-11', 'basis': 'Venustech names this repository and skill path as a poisoned Bybit skill; OpenSourceMalware documents the related AuthTool cryptocurrency lure and credential-stealing campaign.', 'versionCaveat': 'Report points to mutable main; retained commit has the described pattern but exact original incident bytes were not authenticated by a published hash.', 'license': 'No repository license found at the pinned revision during the original source study.'},
    {'id': 'vendor-google-qx4', 'name': 'google-qx4', 'repository': 'aztr0nutzs/NET_NiNjA.v1.2', 'commit': 'b857b9cb9154c9be6f63295cca91d331be28c250', 'path': 'skills/skills-folders/google-qx4/SKILL.md', 'sha256': '46878afd4bb3f3c0ec7c4bab3c9c53af37b5b9546d5da04b6ecc804ddf5c2ab9', 'documentationUrl': 'https://snyk.io/blog/clawhub-malicious-google-skill-openclaw-malware/', 'sourceDate': '2026-02-10', 'basis': 'Snyk documents the malicious Google impersonation skill and fake openclaw-core prerequisite.', 'versionCaveat': 'Report names this repository and a former path. Current retained path moved under skills/skills-folders; exact original incident hash not published.', 'license': 'No repository license found at the pinned revision during the original source study.'},
]

if __name__ == '__main__':
    out = Path(__file__).resolve().parent
    manifest = json.loads((out / 'manifest.json').read_text())
    existing = {s['id'] for s in manifest['samples']}
    for case in CASES:
        if case['id'] in existing:
            continue
        raw = f'https://raw.githubusercontent.com/{case["repository"]}/{case["commit"]}/{case["path"]}'
        data = get(raw)
        if hashlib.sha256(data).hexdigest() != case['sha256']:
            raise ValueError('Vendor case bytes changed: ' + case['id'])
        reason = omit_reason('SKILL.md', data)
        if reason:
            raise ValueError('Vendor case excluded: ' + reason)
        primary = write_inert(out, case['id'], 'SKILL.md', data)
        url = f'https://github.com/{case["repository"]}/blob/{case["commit"]}/{case["path"]}'
        manifest['samples'].append({
            'id': case['id'], 'name': case['name'], 'family': 'vendor:fake-prerequisite-lure', 'sourceFamily': 'mechanism-group; campaign identity not established', 'provenanceKind': 'real-malware',
            'groundTruth': {'label': 'malicious', 'sourceLabel': 'vendor-reported-malicious', 'basis': case['basis'], 'independentOfSkillGate': True, 'incidentVersionVerified': case['id'] == 'vendor-twitter-sum', 'labelScope': 'retained-skill-text', 'verifiedBySkillGate': False, 'adjudicationStatus': 'external-source-label'},
            'sourceUrl': url, 'sourceCommit': case['commit'], 'originalPath': case['path'], 'sha256': primary['sha256'], 'fixturePath': primary['fixturePath'],
            'documentationUrl': case['documentationUrl'], 'sourceDate': case['sourceDate'],
            'documentationEvidence': {'sourceRecordUrl': case['documentationUrl'], 'description': case['basis'], 'versionLimit': case['versionCaveat'], 'additionalCampaignReport': 'https://opensourcemalware.com/blog/malicious-clawhub-skills-target-openclaw-users'},
            'documentedThreatTypes': ['malware-delivery', 'fake-prerequisite-social-engineering'],
            'threatTypeProvenance': 'named vendor incident report; credential theft is a reported downstream campaign impact, not executed here',
            'files': [primary],
            'packageCompleteness': {'status': 'partial-text-only', 'sourceFileCount': None, 'retainedFileCount': 1, 'omitted': [], 'scope': 'Only the vendor-linked SKILL.md was retained. Companion package inventory and remote payloads are not included.'},
            'fidelity': {'modified': False, 'sanitized': False, 'scope': 'Exact bytes from the pinned public GitHub source; original incident-version caveats preserved.'},
            'license': {'statement': case['license'], 'url': f'https://github.com/{case["repository"]}/tree/{case["commit"]}', 'redistributionStatus': 'not-cleared-for-publication'},
            'evaluation': {'partition': 'development-external', 'unseenToModel': 'unknown', 'labelScope': 'retained-skill-text', 'priorSkillGateExposure': 'Previously used in the five-skill external coverage probe.', 'notes': ['Not an unseen validation case.', 'Do not follow prerequisite commands, download executables or contact embedded destinations.', 'Related lure variants are grouped as one conservative family, not three independent campaigns.']}
        })
    manifest['summary'] = {'sampleCount': len(manifest['samples']), 'labels': dict(Counter(s['groundTruth']['label'] for s in manifest['samples'])), 'families': len({s['family'] for s in manifest['samples']}), 'retainedFiles': sum(len(s['files']) for s in manifest['samples'])}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest['summary']))
