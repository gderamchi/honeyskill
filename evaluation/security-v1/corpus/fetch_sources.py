#!/usr/bin/env python3
"""Recover pinned public research archives without extracting or executing them."""
import hashlib
from pathlib import Path
from acquire_controls import get
from build_corpus import PIN, ARCHIVES

if __name__ == '__main__':
    out = Path(__file__).resolve().parent / '.source-cache'
    out.mkdir(exist_ok=True)
    sources = [
        ('msb-metadata__benchmark_manifest.csv', f'https://raw.githubusercontent.com/protectskills/MaliciousSkillBench/{PIN}/metadata/benchmark_manifest.csv', None),
        ('msb-packages__package_manifest.csv', f'https://raw.githubusercontent.com/protectskills/MaliciousSkillBench/{PIN}/packages/package_manifest.csv', None),
        ('liu-data__malicious_skills.csv', 'https://raw.githubusercontent.com/protectskills/MaliciousAgentSkillsBench/f7d28b1a9de4eb33d552529cf79d1065d765f6c3/data/malicious_skills.csv', None),
    ] + [(f'msb-{sid}_packages.tar.gz', f'https://raw.githubusercontent.com/protectskills/MaliciousSkillBench/{PIN}/packages/{sid}_packages.tar.gz', digest) for sid, digest in ARCHIVES.items()]
    for name, url, expected in sources:
        data = get(url, 15_000_000)
        digest = hashlib.sha256(data).hexdigest()
        if expected and digest != expected:
            raise ValueError('Pinned archive mismatch: ' + name)
        (out / name).write_bytes(data)
        print(name, len(data), digest)
