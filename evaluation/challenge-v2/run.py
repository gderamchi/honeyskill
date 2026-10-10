"""Run the frozen same-team synthetic challenge through a selected bundled CLI."""
import argparse
import collections
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

folder = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--cli', type=Path)
parser.add_argument('--output', type=Path)
parser.add_argument('--check-freeze', action='store_true')
args = parser.parse_args()
freeze = json.loads((folder/'freeze.json').read_text())
actual = []
for path in sorted([folder/'cases.json', *(folder/'fixtures').rglob('*')]):
    if path.is_file():
        actual.append({'path': path.relative_to(folder).as_posix(), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
assert actual == freeze['files'], 'Frozen case bytes or labels changed.'
manifest_hash = hashlib.sha256(json.dumps(actual, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
assert manifest_hash == freeze['manifestSha256']
cases = json.loads((folder/'cases.json').read_text())
assert len(cases) == freeze['cases']
assert dict(collections.Counter(case['label'] for case in cases)) == freeze['labels']
assert all(path.name != 'SKILL.md' for path in (folder/'fixtures').rglob('*'))
if args.check_freeze:
    print(json.dumps({'status': 'verified', 'cases': len(cases), 'manifestSha256': manifest_hash}))
    raise SystemExit(0)
if not args.cli or not args.output:
    parser.error('--cli and --output are required for an actual run')
cli = args.cli.resolve(strict=True)
output = args.output.resolve()
assert not output.exists(), 'Refusing to overwrite previous evaluation evidence.'
node = shutil.which('node')
assert node
started = time.perf_counter()
evidence = {
    'schemaVersion': 1, 'kind': 'same-team-synthetic-challenge',
    'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'manifestSha256': manifest_hash,
    'frozenAt': freeze['frozenAt'],
    'independentDataset': False, 'scientificBlindEvaluation': False,
    'cliSha256': hashlib.sha256(cli.read_bytes()).hexdigest(),
    'runnerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'profile': 'static', 'semanticCalls': 0, 'acquiredSkillCodeExecuted': False,
    'skillActivationAttempted': False, 'cases': [],
}
with tempfile.TemporaryDirectory(prefix='sg-challenge-', dir='/tmp') as temporary:
    root = Path(temporary).resolve()
    home = root/'home'; home.mkdir()
    project = root/'project'; project.mkdir()
    inputs = root/'inputs'; inputs.mkdir()
    env = {'PATH': os.environ['PATH'], 'HOME': str(home), 'CODEX_HOME': str(home/'.codex'), 'NO_COLOR': '1'}
    def invoke(arguments):
        return subprocess.run([node, str(cli), *arguments], cwd=project, env=env, capture_output=True, text=True, timeout=30)
    version = invoke(['--version'])
    assert version.returncode == 0, version.stderr
    evidence['cliVersion'] = version.stdout.strip()
    initialized = invoke(['--project', str(project), '--json', 'init', '--agent', 'codex', '--profile', 'static'])
    assert initialized.returncode == 0, initialized.stderr
    for case in cases:
        source = inputs/case['id']
        shutil.copytree(folder/case['fixture'], source)
        (source/'SKILL.md.fixture').rename(source/'SKILL.md')
        before = time.perf_counter()
        result = invoke(['--project', str(project), '--json', 'scan', str(source)])
        item = {'id': case['id'], 'label': case['label'], 'expectedCategories': case['expectedCategories'], 'exitCode': result.returncode, 'durationMs': round((time.perf_counter()-before)*1000, 3)}
        try:
            report = json.loads(result.stdout)
            assert report.get('name') == case['id'] and report.get('decision') in ['allow', 'hold', 'review'], 'No scan report returned.'
            item.update({'decision': report['decision'], 'risk': report['risk'], 'coverage': report['coverage']['status'], 'categories': sorted(set(finding['category'] for finding in report['findings'])), 'engineVersion': report['engineVersion'], 'rulesVersion': report['rulesVersion'], 'fingerprint': report['fingerprint'], 'report': report})
        except (ValueError, AssertionError) as error:
            item.update({'decision': None, 'error': str(error), 'stdout': result.stdout, 'stderr': result.stderr})
        evidence['cases'].append(item)
    assert not (project/'.agents/skills').exists(), 'A scan unexpectedly activated a skill.'
    evidence['noSkillsActivated'] = True
evidence['temporaryRemoved'] = not root.exists()
suspects = [item for item in evidence['cases'] if item['label'] == 'suspect']
legitimate = [item for item in evidence['cases'] if item['label'] == 'legitimate']
evidence['metrics'] = {
    'suspectsWithFindings': {'numerator': sum(bool(item.get('categories')) for item in suspects), 'denominator': len(suspects)},
    'suspectsRetained': {'numerator': sum(item['decision'] in ['hold', 'review'] for item in suspects), 'denominator': len(suspects)},
    'suspectsAllowed': {'numerator': sum(item['decision'] == 'allow' for item in suspects), 'denominator': len(suspects)},
    'legitimateWithFindings': {'numerator': sum(bool(item.get('categories')) for item in legitimate), 'denominator': len(legitimate)},
    'legitimateAutoInstallEligible': {'numerator': sum(item['decision'] == 'allow' for item in legitimate), 'denominator': len(legitimate)},
    'engineErrors': sum(item['decision'] is None for item in evidence['cases']),
}
evidence['durationMs'] = round((time.perf_counter()-started)*1000, 3)
evidence['completedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
evidence['status'] = 'executed'
output.parent.mkdir(parents=True, exist_ok=True)
with output.open('x') as handle:
    json.dump(evidence, handle, indent=2, ensure_ascii=False); handle.write('\n')
print(json.dumps({'status': 'executed', 'cliVersion': evidence['cliVersion'], 'cliSha256': evidence['cliSha256'], 'cases': len(cases), 'manifestSha256': manifest_hash, 'temporaryRemoved': evidence['temporaryRemoved']}))
