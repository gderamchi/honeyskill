#!/usr/bin/env python3
"""Acquire complete externally authored benign research controls as inert bytes.

No acquired code is imported, executed, installed, or followed. Requests go only
to public GitHub metadata and raw-file hosts at one pinned source revision.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import importlib.util
import json
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PIN = '613c37512d16a92731d6f145f67f735f1ced9d20'
REPO = 'zhmzm/AgentTrap'
BASE = f'https://github.com/{REPO}/blob/{PIN}'
RAW = f'https://raw.githubusercontent.com/{REPO}/{PIN}'
PAPER = 'https://arxiv.org/html/2605.13940v1'
FROZEN_HASH = '89d6647ee49fbf81d33e67a4fe0720df2abf34d44020e4121cb99432af641445'
spec = importlib.util.spec_from_file_location('skillgate_corpus_helpers', ROOT.parent / 'corpus' / 'build_corpus.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


class GitHubOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).hostname not in {'api.github.com', 'raw.githubusercontent.com'}:
            raise ValueError('Unexpected redirect host')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def get(url: str, limit: int = 300_000) -> bytes:
    if urllib.parse.urlsplit(url).hostname not in {'api.github.com', 'raw.githubusercontent.com'}:
        raise ValueError('Disallowed retrieval host')
    request = urllib.request.Request(url, headers={'User-Agent': 'SkillGate-benign-control-research'})
    with urllib.request.build_opener(GitHubOnly()).open(request, timeout=30) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Bounded public source exceeded size limit')
    return data


def download(item: dict, prefix: str) -> tuple[str, bytes]:
    data = get(RAW + '/' + urllib.parse.quote(item['path'], safe='/'))
    git_hash = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if git_hash != item['sha'] or len(data) != item['size']:
        raise ValueError('Pinned Git blob integrity mismatch')
    return item['path'][len(prefix):], data


def main() -> None:
    frozen = ROOT.parent / 'corpus' / 'manifest.json'
    if helpers.digest(frozen.read_bytes()) != FROZEN_HASH:
        raise ValueError('Existing frozen corpus changed; review separately')
    if (ROOT / 'manifest.json').exists():
        raise ValueError('Refusing to overwrite an acquired cohort')
    registry_bytes = get(RAW + '/cases/cases.json', 1_000_000)
    registry = json.loads(registry_bytes)
    tree_bytes = get(f'https://api.github.com/repos/{REPO}/git/trees/{PIN}?recursive=1', 2_000_000)
    tree = json.loads(tree_bytes)
    if tree.get('truncated'):
        raise ValueError('Incomplete source tree')
    commit = json.loads(get(f'https://api.github.com/repos/{REPO}/commits/{PIN}', 1_000_000))
    source_date = commit['commit']['committer']['date'][:10]
    samples, excluded, selected_rows, seen = [], [], [], set()
    for row in sorted((r for r in registry if r.get('is_benign') is True), key=lambda r: r['id']):
        if len(samples) == 20:
            break
        stub = f'skills/benign/case_{row["id"]:04d}_'
        matches = [x for x in tree['tree'] if x['path'].startswith(stub)]
        roots = {x['path'].split('/')[2] for x in matches}
        if len(roots) != 1:
            raise ValueError('Ambiguous source package')
        prefix = 'skills/benign/' + next(iter(roots)) + '/'
        inventory = [x for x in matches if x['type'] == 'blob']
        unsupported = [x for x in inventory if x.get('mode') not in {'100644', '100755'} or x.get('size', 0) > 300_000]
        if unsupported:
            excluded.append({'caseId': row['id'], 'reason': 'unsupported-file-mode-or-size', 'paths': [x['path'] for x in unsupported]})
            continue
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            fetched = list(pool.map(lambda x: download(x, prefix), inventory))
        omissions = [{'originalPath': name, 'reason': helpers.omit_reason(name, data)} for name, data in fetched if helpers.omit_reason(name, data)]
        if omissions:
            excluded.append({'caseId': row['id'], 'reason': 'complete-package-required', 'files': omissions})
            continue
        main_bytes = next((b for name, b in fetched if name == 'SKILL.md'), None)
        if main_bytes is None:
            raise ValueError('Missing package primary')
        primary_hash = helpers.digest(main_bytes)
        if primary_hash in seen:
            excluded.append({'caseId': row['id'], 'reason': 'duplicate-primary-bytes'})
            continue
        seen.add(primary_hash)
        sample_id = f'agenttrap-benign-{row["id"]:04d}'
        files = [helpers.write_inert(ROOT, sample_id, name, data) for name, data in sorted(fetched)]
        primary = next(f for f in files if f['originalPath'] == 'SKILL.md')
        label_bearing = [name for name, data in fetched if name == 'source_meta.json' or b'Benign Fixture' in data or b'benign_control' in data]
        samples.append({
            'id': sample_id, 'name': row['skill_name'],
            'family': 'agenttrap:' + row['skill_name'],
            'sourceFamily': row.get('source_slug', row['skill_name']),
            'provenanceKind': 'research-control',
            'groundTruth': {
                'label': 'benign', 'sourceLabel': 'is_benign=true',
                'basis': 'External AgentTrap authors classify this constructed utility case as benign and publish its allowed task, pass condition and failure condition. This is author-intended bounded utility, not an independent human audit of an in-the-wild package.',
                'independentOfSkillGate': True, 'incidentVersionVerified': False,
                'labelScope': 'constructed-task-conditioned-utility',
                'verifiedBySkillGate': False, 'adjudicationStatus': 'external-author-intended-benign-control',
            },
            'sourceUrl': f'{BASE}/{prefix}SKILL.md', 'sourceCommit': PIN,
            'originalPath': prefix + 'SKILL.md', 'sha256': primary_hash,
            'fixturePath': primary['fixturePath'], 'documentationUrl': PAPER,
            'sourceDate': source_date,
            'documentationEvidence': {
                'sourceRecordUrl': f'{BASE}/cases/cases.json', 'caseId': row['id'],
                'sourceRecordSha256': helpers.digest(registry_bytes),
                'sourceLabel': {'is_benign': True, 'modality': row.get('modality')},
                'userTrigger': row['user_trigger'], 'passCondition': row['pass_condition'],
                'failCondition': row['fail_condition'], 'utilitySignal': row.get('success_signal'),
                'description': 'AgentTrap section 4 describes construction of benign utility cases. The pinned case registry provides the independent source label and task-scoped behavioral expectations. Source runtime judging is not reproduced here.',
            },
            'documentedThreatTypes': [],
            'threatTypeProvenance': 'No positive threat label; negative research control under the published user task.',
            'files': files,
            'packageCompleteness': {
                'status': 'complete-preserved-snapshot', 'sourceFileCount': len(inventory),
                'retainedFileCount': len(files), 'omitted': [],
                'scope': 'Every Git blob in the pinned skill directory; external task workspace, dependencies, services, and source runtime are not acquired or executed.',
            },
            'fidelity': {'modified': False, 'sanitized': False, 'scope': 'Exact pinned Git blob bytes; inert .fixture suffix and non-executable permissions only. No label-bearing source content removed.'},
            'license': {
                'statement': 'Several skill files declare MIT or retain upstream notices. No repository-wide license was located at this revision; declarations do not establish rights for every companion file.',
                'url': f'{BASE}/{prefix}SKILL.md', 'redistributionStatus': 'not-cleared-for-publication',
            },
            'evaluation': {
                'partition': 'development-external-constructed-negative', 'unseenToModel': 'unknown',
                'labelScope': 'constructed-task-conditioned-utility',
                'priorSkillGateExposure': 'Acquired during security-v1 development; not a sealed holdout.',
                'sourceLabelBearingFiles': label_bearing,
                'notes': [
                    'Report FP/TN separately for research-control provenance; do not estimate in-the-wild false-positive rate from these cases.',
                    'The benign label is conditional on the published task authorization. Legitimate network use, deletion, or secret management is not intrinsically malicious.',
                    'Explicit benign labels and repeated safe-workflow wording can leak the target label. This is an overblocking smoke cohort, not a blinded accuracy benchmark.',
                    'Complete package acquisition does not establish support by the AVAX-send behavioral runner. Unsupported behavior stays outside TP/FP/TN/FN.',
                    'No code was executed and no service, private data, or credentials were used.',
                ],
            },
        })
        selected_rows.append(row)
    if len(samples) != 20:
        raise ValueError('Unable to acquire 20 complete distinct-primary controls')
    manifest = {
        'schemaVersion': 1, 'corpusId': 'security-v1-agenttrap-negative-controls',
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'policy': {
            'execution': 'inert-files-only',
            'publication': 'local-research-corpus; per-artifact rights not cleared',
            'groundTruth': 'External author-intended benign constructed task labels, independent of SkillGate predictions. Not human-adjudicated in-the-wild safety labels.',
            'holdout': 'Development research controls, with visible source label cues; not blinded or unseen validation.',
            'completeness': 'Only complete pinned skill directories are admitted. Task environments and external dependencies are outside retained package scope.',
            'familyMeaning': 'Source skill names; repeated names share one family. Not independent authors or deployment environments.',
            'selection': 'Ascending external case ID, complete package and distinct primary bytes required; stop at 20. No SkillGate detector result used for selection.',
        },
        'sources': [{'id': 'AgentTrap', 'name': 'AgentTrap', 'documentationUrl': PAPER, 'sourceDate': source_date, 'sourceCommit': PIN, 'registryUrl': f'{BASE}/cases/cases.json', 'registrySha256': helpers.digest(registry_bytes), 'treeResponseSha256': helpers.digest(tree_bytes)}],
        'samples': samples, 'exclusions': excluded,
        'summary': {'sampleCount': len(samples), 'labels': dict(Counter(s['groundTruth']['label'] for s in samples)), 'families': len({s['family'] for s in samples}), 'retainedFiles': sum(len(s['files']) for s in samples)},
    }
    (ROOT / 'case-records.json').write_text(json.dumps(selected_rows, indent=2) + '\n')
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    if helpers.digest(frozen.read_bytes()) != FROZEN_HASH:
        raise ValueError('Frozen corpus was changed by another writer')
    print(json.dumps(manifest['summary']))


if __name__ == '__main__':
    main()
