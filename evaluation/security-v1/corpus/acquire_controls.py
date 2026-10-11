#!/usr/bin/env python3
"""Retrieve pinned upstream controls as inert fixtures; never follow skill URLs."""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from build_corpus import omit_reason, write_inert

CONTROLS = [
    ('binance/binance-skills-hub', '9960c675387bd27f8866645b83693c1fa87242f6', '2026-09-11', [
        'skills/binance/onchain-pay', 'skills/binance-web3/binance-agentic-wallet',
        'skills/binance-web3/binance-wallet-tracker', 'skills/binance-web3/query-token-audit',
        'skills/binance-web3/query-token-info']),
    ('circlefin/skills', '04cbd18fdf7e2e459452f2a94594fb5c526d9908', '2026-10-09', [
        'plugins/circle/skills/agent-wallet-policy', 'plugins/circle/skills/bridge-tokens',
        'plugins/circle/skills/pay-via-agent-wallet', 'plugins/circle/skills/swap-tokens',
        'plugins/circle/skills/use-user-controlled-wallets', 'plugins/circle/skills/use-usdc',
        'plugins/circle/skills/use-circle-cli']),
    ('anthropics/skills', 'dbd4588f9e1033efb41dad4bef2f7947c8993d44', '2026-10-09', [
        'skills/brand-guidelines', 'skills/frontend-design']),
]


def get(url: str, limit: int = 300_000) -> bytes:
    if urlparse(url).hostname not in {'api.github.com', 'raw.githubusercontent.com'}:
        raise ValueError('Network host outside public-source allowlist')
    with urlopen(Request(url, headers={'User-Agent': 'SkillGate-defensive-corpus-research'}), timeout=30) as response:
        if urlparse(response.url).hostname not in {'api.github.com', 'raw.githubusercontent.com'}:
            raise ValueError('Redirect outside public-source allowlist')
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Public source exceeds bound')
    return data


def acquire(out: Path):
    manifest = json.loads((out / 'manifest.json').read_text())
    existing = {s['id'] for s in manifest['samples']}
    for repo, commit, date, directories in CONTROLS:
        tree = json.loads(get(f'https://api.github.com/repos/{repo}/git/trees/{commit}?recursive=1', 10_000_000))
        if tree.get('truncated'):
            raise ValueError('Incomplete upstream tree: ' + repo)
        for directory in directories:
            sample_id = 'control-' + repo.split('/')[0] + '-' + directory.split('/')[-1]
            if sample_id in existing:
                continue
            members = [m for m in tree['tree'] if m['type'] == 'blob' and m['path'].startswith(directory + '/')]
            def retrieve(member):
                original = member['path'][len(directory) + 1:]
                if member.get('size', 0) > 300_000:
                    return original, None, member, 'file-size-limit'
                data = get(f'https://raw.githubusercontent.com/{repo}/{commit}/{quote(member["path"])}')
                git_hash = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
                if git_hash != member['sha']:
                    raise ValueError('Git blob mismatch: ' + original)
                return original, data, member, omit_reason(original, data)
            files, omitted = [], []
            with ThreadPoolExecutor(max_workers=4) as pool:
                for original, data, member, reason in pool.map(retrieve, members):
                    if reason:
                        omitted.append({'originalPath': original, 'gitBlobSha1': member['sha'], 'bytes': member.get('size'), 'reason': reason})
                    else:
                        files.append(write_inert(out, sample_id, original, data))
            primary = next(f for f in files if f['originalPath'] == 'SKILL.md')
            url = f'https://github.com/{repo}/blob/{commit}/{directory}/SKILL.md'
            manifest['samples'].append({
                'id': sample_id, 'name': directory.split('/')[-1], 'family': 'upstream:' + repo,
                'sourceFamily': None, 'provenanceKind': 'upstream-control',
                'groundTruth': {'label': 'unknown', 'sourceLabel': 'official-upstream-control', 'basis': 'Authentic maintained upstream skill, not independently certified benign. Legitimate intended functionality does not establish absence of vulnerabilities.', 'independentOfSkillGate': True, 'incidentVersionVerified': False, 'labelScope': 'source-package', 'verifiedBySkillGate': False, 'adjudicationStatus': 'unadjudicated-control'},
                'sourceUrl': url, 'sourceCommit': commit, 'originalPath': directory + '/SKILL.md',
                'sha256': primary['sha256'], 'fixturePath': primary['fixturePath'],
                'documentationUrl': f'https://github.com/{repo}/blob/{commit}/README.md', 'sourceDate': date,
                'documentationEvidence': {'sourceRecordUrl': url, 'gitTreeUrl': f'https://api.github.com/repos/{repo}/git/trees/{commit}?recursive=1', 'description': 'Retrieved from the named upstream organization at a pinned commit. Each retained file matched its Git blob SHA-1; local SHA-256 recorded.'},
                'documentedThreatTypes': [], 'threatTypeProvenance': 'not-applicable; no malicious label assigned',
                'files': files,
                'packageCompleteness': {'status': 'partial-filtered' if omitted else 'complete-preserved-snapshot', 'sourceFileCount': len(members), 'retainedFileCount': len(files), 'omitted': omitted, 'scope': 'Selected skill directory at pinned upstream commit; shared plugin resources and external dependencies are not included.'},
                'fidelity': {'modified': False, 'sanitized': False, 'scope': 'Retained files are exact upstream bytes with inert .fixture suffixes.'},
                'license': {'statement': 'Retained local license files apply when present; upstream and per-skill terms must be reviewed before redistribution.', 'url': f'https://github.com/{repo}/tree/{commit}', 'redistributionStatus': 'not-cleared-for-publication'},
                'evaluation': {'partition': 'development-external-control', 'unseenToModel': 'unknown', 'labelScope': 'source-package', 'notes': ['Unknown label: exclude from TP/FP/TN/FN until independent adjudication under a defined threat model.', 'Warnings on real finance capabilities are not automatically false positives.', 'No installation, upstream commands, real account access or provider calls.']}
            })
            print(sample_id, len(files), 'inert files')
    manifest['updatedAt'] = datetime.now(timezone.utc).isoformat()
    manifest['summary'] = {'sampleCount': len(manifest['samples']), 'labels': dict(Counter(s['groundTruth']['label'] for s in manifest['samples'])), 'families': len({s['family'] for s in manifest['samples']}), 'retainedFiles': sum(len(s['files']) for s in manifest['samples'])}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest['summary']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parent)
    acquire(parser.parse_args().output_dir)
