#!/usr/bin/env python3
"""Offline integrity checks only; never execute or import fixture content."""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FROZEN_HASH = '89d6647ee49fbf81d33e67a4fe0720df2abf34d44020e4121cb99432af641445'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    manifest_bytes = (ROOT / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    expected_files = set()
    primary_hashes = set()
    total_bytes = 0
    records = {r['id']: r for r in json.loads((ROOT / 'case-records.json').read_text())}
    for sample in manifest['samples']:
        assert sample['provenanceKind'] == 'research-control'
        assert sample['groundTruth']['label'] == 'benign'
        assert sample['groundTruth']['independentOfSkillGate'] is True
        assert sample['groundTruth']['labelScope'] == 'constructed-task-conditioned-utility'
        record = records[sample['documentationEvidence']['caseId']]
        assert record['is_benign'] is True
        assert record['user_trigger'] == sample['documentationEvidence']['userTrigger']
        assert record['pass_condition'] == sample['documentationEvidence']['passCondition']
        assert record['fail_condition'] == sample['documentationEvidence']['failCondition']
        completeness = sample['packageCompleteness']
        assert completeness['status'] == 'complete-preserved-snapshot'
        assert not completeness['omitted']
        assert completeness['sourceFileCount'] == completeness['retainedFileCount'] == len(sample['files'])
        assert sample['sha256'] not in primary_hashes
        primary_hashes.add(sample['sha256'])
        assert sample['fidelity']['modified'] is False
        assert sample['fidelity']['sanitized'] is False
        for file in sample['files']:
            relative = Path(file['fixturePath'])
            assert not relative.is_absolute() and '..' not in relative.parts
            assert relative.parts[:2] == ('samples', sample['id'])
            path = ROOT / relative
            assert path.suffix == '.fixture'
            assert not path.is_symlink() and path.is_file()
            assert not (path.stat().st_mode & 0o111)
            data = path.read_bytes()
            assert len(data) == file['bytes'] and sha(data) == file['sha256']
            assert file['modified'] is False
            data.decode('utf-8')
            assert b'\0' not in data
            assert relative.as_posix() not in expected_files
            expected_files.add(relative.as_posix())
            total_bytes += len(data)
        primary = next(f for f in sample['files'] if f['originalPath'] == 'SKILL.md')
        assert primary['fixturePath'] == sample['fixturePath'] and primary['sha256'] == sample['sha256']
    assert len(manifest['samples']) == len(records) == 20
    actual_files = {p.relative_to(ROOT).as_posix() for p in (ROOT / 'samples').rglob('*') if p.is_file()}
    assert expected_files == actual_files
    frozen_hash = sha((ROOT.parent / 'corpus' / 'manifest.json').read_bytes())
    assert frozen_hash == FROZEN_HASH
    result = {
        'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'passed',
        'manifestSha256': sha(manifest_bytes), 'frozenOriginalManifestSha256': frozen_hash,
        'sampleCount': len(manifest['samples']), 'labels': dict(Counter(s['groundTruth']['label'] for s in manifest['samples'])),
        'retainedFiles': len(expected_files), 'retainedBytes': total_bytes,
        'distinctPrimaryHashes': len(primary_hashes), 'sourceSkillFamilies': len({s['family'] for s in manifest['samples']}),
        'completePreservedPackages': len(manifest['samples']), 'executedFixtureFiles': 0,
        'scope': 'Integrity, source-label consistency and exact retained file accounting only. No detector accuracy or runtime-safety claim.',
    }
    (ROOT / 'validation.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
