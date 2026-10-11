#!/usr/bin/env python3
"""Import preserved research artifacts as inert bytes; never import or execute them.

Requires the retained research cache used by the original source study. Network
control acquisition is separate and uses pinned public GitHub commits only.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import tarfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

PIN = '893afd609be22a2dfac5a2b94bbebb4eeb99515e'
BASE = f'https://github.com/protectskills/MaliciousSkillBench/blob/{PIN}'
ARCHIVES = {
    'SRC002': 'bf2532cb0e7fd3a76a2cf1bbb53cff1cd77fe67b3f152f802c084ef196860ed5',
    'SRC004': '206ab5bde4177475ba1d9da3f711197c38e082329b77aee969f99ecbbc385701',
}
SOURCES = {
    'SRC002': {'id': 'SRC002', 'name': 'MaliciousAgentSkillsBench', 'documentationUrl': 'https://arxiv.org/html/2602.06547v3', 'sourceDate': '2026-06-01', 'originalDataset': 'https://huggingface.co/datasets/ProtectSkills/MaliciousAgentSkillsBench', 'labelEvidence': 'Study-author manual annotation and behavioral verification; source asserts in-the-wild provenance. Not independently re-executed by SkillGate.', 'license': 'Source project states MIT; consolidated third-party artifacts retain original upstream terms. Original attacker-repository licenses are not established.'},
    'SRC004': {'id': 'SRC004', 'name': 'SkillLeakBench', 'documentationUrl': 'https://arxiv.org/html/2604.03070v1', 'sourceDate': '2026-04-03', 'originalDataset': 'https://huggingface.co/datasets/AgentSkillPrivacy/SkillLeakBench', 'labelEvidence': 'Study-author runtime verification and manual distinction between vulnerable and deliberately malicious skills; selected rows carry malicious/wild labels. Not independently re-executed by SkillGate.', 'license': 'Consolidated third-party artifacts retain original upstream terms; artifact-specific redistribution rights not established.'},
}
SECRET_PATTERNS = [
    ('private-key-pem', re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
    ('aws-access-key', re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b')),
    ('github-token', re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b')),
    ('provider-token', re.compile(rb'\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b')),
    ('literal-private-key-assignment', re.compile(rb'(?:private[_ -]?key|secret[_ -]?key)\s*[=:]\s*[\x22\x27](?:0x)?[a-fA-F0-9]{64}[\x22\x27]', re.I)),
]
TEXT_SUFFIXES = {'.md', '.txt', '.json', '.py', '.js', '.ts', '.cjs', '.mjs', '.sh', '.rb', '.sql', '.html', '.css', '.toml', '.yaml', '.yml', '.xsd', '.svg', '.backup', ''}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def omit_reason(name: str, data: bytes) -> str | None:
    if len(data) > 300_000:
        return 'file-size-limit'
    if Path(name).name in {'.DS_Store'} or Path(name).suffix.lower() not in TEXT_SUFFIXES:
        return 'non-text-or-generated-artifact'
    if b'\0' in data:
        return 'binary-artifact'
    try:
        data.decode('utf-8')
    except UnicodeDecodeError:
        return 'non-utf8-artifact'
    for label, pattern in SECRET_PATTERNS:
        if pattern.search(data):
            return 'sensitive-material-pattern:' + label
    return None


def write_inert(out: Path, sample_id: str, original: str, data: bytes) -> dict:
    path = PurePosixPath(original)
    if path.is_absolute() or '..' in path.parts:
        raise ValueError('Unsafe source path')
    target = Path('samples') / sample_id / (original + '.fixture')
    dest = out / target
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    dest.chmod(0o644)
    return {'originalPath': original, 'fixturePath': target.as_posix(), 'sha256': digest(data), 'bytes': len(data), 'modified': False}


def build(cache: Path, out: Path) -> dict:
    brs = {r['benchmark_id']: r for r in csv.DictReader((cache / 'msb-metadata__benchmark_manifest.csv').open())}
    prs = list(csv.DictReader((cache / 'msb-packages__package_manifest.csv').open()))
    original_rows = {(r['repo'], r['skill_name']): r for r in csv.DictReader((cache / 'liu-data__malicious_skills.csv').open())}
    samples, exclusions = [], []
    for sid, expected_hash in ARCHIVES.items():
        archive = cache / f'msb-{sid}_packages.tar.gz'
        if digest(archive.read_bytes()) != expected_hash:
            raise ValueError('Research archive hash mismatch: ' + sid)
        with tarfile.open(archive) as tar:
            candidates = []
            for pr in prs:
                if pr['source_id'] != sid:
                    continue
                br = brs[pr['benchmark_id']]
                if br['provenance'] != 'wild' or pr['sanitized'] != 'no' or br['text_redacted'] != 'false':
                    exclusions.append({'benchmarkId': br['benchmark_id'], 'reason': 'not-unsanitized-wild-source'})
                    continue
                prefix = pr['package_relative_path'] + '/'
                members = [m for m in tar.getmembers() if m.isfile() and m.name.startswith(prefix)]
                main = next((m for m in members if m.name.lower().endswith('/skill.md') and digest(tar.extractfile(m).read()) == br['exact_hash']), None)
                if main is None:
                    exclusions.append({'benchmarkId': br['benchmark_id'], 'reason': 'exact-primary-text-not-found'})
                    continue
                primary = tar.extractfile(main).read()
                reason = omit_reason(main.name, primary)
                if reason:
                    exclusions.append({'benchmarkId': br['benchmark_id'], 'reason': reason})
                    continue
                group = prefix.split('/')[1] if sid == 'SRC002' else br['structural_family_id']
                candidates.append((group, pr, br, members, main))
            # One case per original anonymized repository for SRC002. Source
            # structural IDs are retained separately; they are not campaigns.
            # This is a development set, not a performance-based selection.
            chosen, seen = [], set()
            priority_names = {'lawpay', 'autotrader', 'x402_payment_tron', 'polymarket-btc15m', 'nervepay', 'arbitrum-dapp-skill'}
            def key(candidate):
                group, pr, br, members, main = candidate
                txt = tar.extractfile(main).read().decode('utf8')
                return (not any(re.search(r'^name:\s*[\x22\x27]?' + re.escape(n) + r'\b', txt, re.M) for n in priority_names), group, br['benchmark_id'])
            for item in sorted(candidates, key=key):
                if item[0] in seen:
                    continue
                seen.add(item[0]); chosen.append(item)
                if sid == 'SRC002' and len(chosen) == 45:
                    break
            for group, pr, br, members, main in chosen:
                sample_id = sid.lower() + '-' + br['benchmark_id'].lower().replace('_', '-')
                prefix = pr['package_relative_path'] + '/'
                files, omitted = [], []
                for member in members:
                    data = tar.extractfile(member).read()
                    original = member.name[len(prefix):]
                    reason = omit_reason(original, data)
                    if reason:
                        omitted.append({'originalPath': original, 'sha256': digest(data), 'bytes': len(data), 'reason': reason})
                    else:
                        files.append(write_inert(out, sample_id, original, data))
                main_path = main.name[len(prefix):]
                primary = next(f for f in files if f['originalPath'] == main_path)
                txt = tar.extractfile(main).read().decode('utf8')
                match = re.search(r'^name:\s*(.+)$', txt, re.M)
                name = match.group(1).strip().strip('\x22\x27') if match else main.name.split('/')[-2]
                src = SOURCES[sid]
                source_row = original_rows.get((group, main.name.split('/')[-2])) if sid == 'SRC002' else None
                patterns = source_row['Pattern'].split('; ') if source_row else [x.strip() for x in br['attack_categories'].split(';') if x.strip()]
                samples.append({
                    'id': sample_id, 'name': name, 'family': sid.lower() + ':' + group,
                    'sourceFamily': br['structural_family_id'], 'provenanceKind': 'real-malware',
                    'groundTruth': {'label': 'malicious', 'sourceLabel': 'malicious', 'basis': src['labelEvidence'], 'independentOfSkillGate': True, 'incidentVersionVerified': False, 'labelScope': 'source-package', 'verifiedBySkillGate': False, 'adjudicationStatus': 'external-source-label'},
                    'sourceUrl': f'{BASE}/packages/{sid}_packages.tar.gz', 'sourceCommit': PIN,
                    'originalPath': main.name, 'sha256': primary['sha256'], 'fixturePath': primary['fixturePath'],
                    'documentationUrl': src['documentationUrl'], 'sourceDate': src['sourceDate'],
                    'documentationEvidence': {'benchmarkId': br['benchmark_id'], 'sourceRecordUrl': f'{BASE}/metadata/benchmark_manifest.csv', 'packageRecordUrl': f'{BASE}/packages/package_manifest.csv', 'originalDataset': src['originalDataset'], 'sourceEvidenceType': br['evidence_type'], 'sourceProvenance': br['provenance'], 'originalAnnotation': source_row, 'description': 'Exact case-level malicious label is in the pinned manifest; the paper documents source-level adjudication. The archive preserves research snapshots, not authenticated attacker commits or victim incidents.'},
                    'documentedThreatTypes': sorted(set(patterns)),
                    'threatTypeProvenance': 'original-study-case-annotation' if source_row else 'consolidator-derived-taxonomy; not independently verified fine-grained labels',
                    'files': files,
                    'packageCompleteness': {'status': 'partial-filtered' if omitted else 'complete-preserved-snapshot', 'sourceFileCount': len(members), 'retainedFileCount': len(files), 'omitted': omitted, 'scope': 'Files in the published archive only; remote payloads and external dependencies are not fetched.'},
                    'fidelity': {'modified': False, 'sanitized': False, 'scope': 'Retained file bytes exactly match the pinned research archive. Renamed inert fixtures. Sensitive-pattern and binary files are omitted, never silently rewritten.', 'archiveSha256': expected_hash, 'sourceReleaseFidelity': pr['release_fidelity']},
                    'license': {'statement': src['license'], 'url': f'{BASE}/THIRD_PARTY_NOTICE.md', 'redistributionStatus': 'not-cleared-for-publication'},
                    'evaluation': {'partition': 'development-external', 'unseenToModel': 'unknown', 'labelScope': 'source-package', 'priorSkillGateExposure': 'Source screened in prior research; not an untouched holdout.', 'notes': ['No malware execution or contact with embedded endpoints.', 'Missing files or unsupported tools must be reported separately from clean behavior.', 'Source study labels are external evidence, not independent SkillGate reproduction.'] + (['Finance capability alone does not establish maliciousness. The retained public study label lacks a published per-case theft trace; independent adjudication is recommended before using this case for a blockchain-theft claim.'] if name in {'x402_payment_tron', 'nervepay', 'polymarket-btc15m'} else [])}
                })
    result = {
        'schemaVersion': 1, 'corpusId': 'security-v1-real-skills', 'createdAt': datetime.now(timezone.utc).isoformat(),
        'policy': {'execution': 'inert-files-only', 'publication': 'local-research-corpus; per-artifact rights not cleared', 'groundTruth': 'External source labels; unknown controls excluded from confusion matrices.', 'holdout': 'Development corpus, not an unseen or independent validation set.', 'completeness': 'Snapshot completeness and executable coverage are separate. External payloads never retrieved.', 'familyMeaning': 'Source repository groups for SRC002; structural groups for SRC004; a conservative lure-mechanism group for vendor cases; organization/repository groups for controls. These are not independent criminal-campaign counts.'},
        'sources': list(SOURCES.values()), 'samples': samples, 'exclusions': exclusions,
        'summary': {'sampleCount': len(samples), 'labels': dict(Counter(s['groundTruth']['label'] for s in samples)), 'families': len({s['family'] for s in samples}), 'retainedFiles': sum(len(s['files']) for s in samples)}
    }
    (out / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    result = build(args.cache_dir, args.output_dir)
    print(json.dumps(result['summary']))
