#!/usr/bin/env python3
"""Independently check corpus bytes, paths, counts, and evidence metadata offline."""
import hashlib
import json
import stat
from collections import Counter
from pathlib import Path, PurePosixPath

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
samples = manifest['samples']
assert len({sample['id'] for sample in samples}) == len(samples), 'Duplicate sample identity'
known_files = set()
for sample in samples:
    assert sample['sourceCommit'] and len(sample['sourceCommit']) == 40
    assert sample['groundTruth']['label'] in {'malicious', 'benign', 'unknown'}
    assert sample['documentationUrl'].startswith('https://')
    assert sample['provenanceKind'] in {'real-malware', 'upstream-control', 'synthetic'}
    assert sample['evaluation']['unseenToModel'] == 'unknown'
    if sample['provenanceKind'] == 'upstream-control':
        assert sample['groundTruth']['label'] == 'unknown', 'Control cannot silently become certified benign'
    for record in sample['files']:
        rel = PurePosixPath(record['fixturePath'])
        assert not rel.is_absolute() and '..' not in rel.parts
        path = root / rel
        assert path.suffix == '.fixture' and not path.is_symlink()
        assert not (path.stat().st_mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH))
        data = path.read_bytes()
        assert len(data) == record['bytes']
        assert hashlib.sha256(data).hexdigest() == record['sha256'], record['fixturePath']
        known_files.add(record['fixturePath'])
    assert sample['packageCompleteness']['retainedFileCount'] == len(sample['files'])
    primary = next(f for f in sample['files'] if f['fixturePath'] == sample['fixturePath'])
    assert primary['sha256'] == sample['sha256']
actual_files = {p.relative_to(root).as_posix() for p in (root / 'samples').rglob('*') if p.is_file()}
assert actual_files == known_files, 'Unindexed or missing fixture'
assert not list((root / 'samples').rglob('SKILL.md')), 'Discoverable SKILL.md must never be present'
summary = {
    'sampleCount': len(samples),
    'labels': dict(Counter(s['groundTruth']['label'] for s in samples)),
    'families': len({s['family'] for s in samples}),
    'retainedFiles': sum(len(s['files']) for s in samples),
}
assert summary == manifest['summary']
print(json.dumps({'status': 'passed', **summary, 'primaryHashDuplicates': sum(n - 1 for n in Counter(s['sha256'] for s in samples).values() if n > 1), 'bytesVerified': sum(f['bytes'] for s in samples for f in s['files']), 'completeness': dict(Counter(s['packageCompleteness']['status'] for s in samples))}, indent=2))
