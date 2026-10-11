#!/usr/bin/env python3
"""Read-only, dependency-free audit of SkillGate development reruns.

No product imports: scoring is independently recomputed from recorded cases.
Outputs contain identities, counters and public rule codes, never source excerpts.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ENGINES = ('native', 'cisco', 'semantic', 'combined')
REASONS = ('error', 'unsupported', 'partial', 'notRequested', 'missingEngine', 'partialPackage', 'coverageGap')
CLASSES = ('TP', 'FP', 'TN', 'FN')
LABELS = ('malicious', 'benign', 'unknown')
MANIFESTS = {'external': 'evaluation/security-v1/corpus/manifest.json',
             'controls': 'evaluation/security-v1/negative-corpus/manifest.json'}
ALERTS = {'medium', 'high', 'critical'}


def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique(items, key, context):
    result = {item[key]: item for item in items}
    require(len(result) == len(items), f'Duplicate {context}')
    return result


def stage_results(case, engine):
    review = case.get('review', {})
    return [stage for stage in review.get('engines', [])
            if stage['engine'] in review.get('selectedEngines', [])] if engine == 'combined' else [
                stage for stage in review.get('engines', []) if stage['engine'] == engine]


def label(case):
    truth = case['sample']['groundTruth']
    return truth['label'] if truth['independentOfSkillGate'] else 'unknown'


def abstention(case, engine='combined'):
    review = case.get('review')
    if not review or case.get('error'):
        return 'error'
    stages = stage_results(case, engine)
    if not stages or (engine == 'combined' and len(stages) != len(review['selectedEngines'])):
        return 'missingEngine'
    for state, reason in [('error', 'error'), ('unsupported', 'unsupported'),
                          ('partial', 'partial'), ('not_requested', 'notRequested')]:
        if any(stage['status'] == state for stage in stages):
            return reason
    if case['sample']['packageCompleteness']['status'] != 'complete-preserved-snapshot':
        return 'partialPackage'
    if review['coverage']['gaps']:
        return 'coverageGap'
    return None


def detected(case, engine='combined'):
    return any(finding['severity'] in ALERTS for stage in stage_results(case, engine)
               for finding in stage['findings'])


def outcome(case, engine='combined'):
    reason = abstention(case, engine)
    if reason:
        return f'INCOMPLETE:{reason}'
    if label(case) == 'unknown':
        return 'UNKNOWN'
    if label(case) == 'malicious':
        return 'TP' if detected(case, engine) else 'FN'
    return 'FP' if detected(case, engine) else 'TN'


def ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def score(cases, engine='combined'):
    counts = Counter(outcome(case, engine) for case in cases)
    labels = Counter(label(case) for case in cases)
    tp, fp, tn, fn = (counts[k] for k in CLASSES)
    complete = tp + fp + tn + fn + counts['UNKNOWN']
    both = tp + fn > 0 and fp + tn > 0
    return {
        'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn, 'unknown': counts['UNKNOWN'],
        'incomplete': len(cases) - complete, 'attempted': len(cases),
        'abstentions': {r: counts[f'INCOMPLETE:{r}'] for r in REASONS},
        'labels': {k: labels[k] for k in LABELS},
        'coverage': {'complete': complete, 'labelled': tp + fp + tn + fn,
                     'malicious': tp + fn, 'benign': fp + tn,
                     'rate': ratio(complete, len(cases)),
                     'labelledRate': ratio(tp + fp + tn + fn, labels['malicious'] + labels['benign']),
                     'maliciousRate': ratio(tp + fn, labels['malicious']),
                     'benignRate': ratio(fp + tn, labels['benign'])},
        'precision': ratio(tp, tp + fp) if both else None,
        'recall': ratio(tp, tp + fn), 'falsePositiveRate': ratio(fp, fp + tn),
        'accuracy': ratio(tp + tn, tp + fp + tn + fn) if both else None,
        'endToEndDetectionFloor': None if counts['INCOMPLETE:notRequested'] == len(cases) else ratio(tp, labels['malicious']),
    }


def metrics(cases):
    result = {engine: score(cases, engine) for engine in ENGINES}
    for field, prefix in [('provenanceKind', 'combined'), ('family', 'family'), ('documentationUrl', 'source')]:
        for value in sorted({case['sample'][field] for case in cases}):
            result[f'{prefix}:{value}'] = score([case for case in cases if case['sample'][field] == value])
    return result


def fingerprint(manifest):
    return digest(packed([{k: entry[k] for k in ('path', 'size', 'sha256', 'executable')}
                          for entry in sorted(manifest, key=lambda item: item['path'])]))


def skill_root(sample):
    matches = [entry['originalPath'] for entry in sample['files']
               if Path(entry['originalPath']).name == 'SKILL.md' and entry['sha256'] == sample['sha256']
               and (sample['originalPath'] == entry['originalPath'] or
                    sample['originalPath'].endswith('/' + entry['originalPath']))]
    require(len(matches) == 1, f'Ambiguous primary file: {sample["id"]}')
    root = str(Path(matches[0]).parent)
    return '' if root == '.' else root + '/'


def validate_semantic_ledger(stage, identity):
    requests = stage.get('requests')
    if not requests:
        require(not stage.get('batching'), f'Batching without request ledger: {identity}')
        return [stage['responseId']] if stage.get('responseId') else []
    batching = stage.get('batching')
    require(stage.get('transport') == 'openai-responses', f'Mocked or unknown semantic transport: {identity}')
    require(batching is not None and batching['strategy'] == 'source-id-batches-v1', f'Missing batch provenance: {identity}')
    require(batching['planned'] == len(requests) and batching['completed'] == sum(r['status'] == 'complete' for r in requests), f'Invalid batch coverage: {identity}')
    require([r['batch'] for r in requests] == list(range(1, len(requests) + 1)), f'Nonsequential batches: {identity}')
    source_ids = [source_id for request in requests for source_id in request['sourceIds']]
    require(len(set(source_ids)) == len(source_ids), f'Duplicate source IDs: {identity}')
    require(source_ids == [f's{i:07d}' for i in range(1, len(source_ids) + 1)], f'Source coverage ID gaps: {identity}')
    totals = {key: 0 for key in ('inputTokens', 'outputTokens', 'totalTokens')}
    ids = []
    for request in requests:
        require(request['status'] in ('complete', 'partial', 'error'), f'Invalid request status: {identity}')
        require(not (request['status'] == 'complete' and request['errors']), f'Completed request has errors: {identity}')
        if request['status'] == 'complete':
            require(request.get('responseId') and request.get('model') == 'gpt-6-luna' and request.get('usage'), f'Completed request lacks live metadata: {identity}')
        if request.get('responseId'):
            ids.append(request['responseId'])
        if request.get('model'):
            require(request['model'] == 'gpt-6-luna', f'Unexpected request model: {identity}')
        if request.get('usage'):
            usage = request['usage']
            require(usage['inputTokens'] + usage['outputTokens'] == usage['totalTokens'], f'Invalid request token sum: {identity}')
            for key in totals:
                totals[key] += usage[key]
    require(stage.get('usage', totals) == totals, f'Invalid aggregated token usage: {identity}')
    if stage.get('responseId'):
        require(len(requests) == 1 and stage['responseId'] == requests[0].get('responseId'), f'Conflicting legacy response ID: {identity}')
    derived = 'error' if any(r['status'] == 'error' for r in requests) else 'partial' if any(r['status'] == 'partial' for r in requests) else 'complete'
    require(stage['status'] == derived, f'Invalid aggregated semantic status: {identity}')
    return ids


def semantic_work(cases):
    result = {'scheduledRequestCount': 0, 'providerResponsesRecorded': 0, 'batchStrategyCases': 0,
              'batchSourceBytes': 0, 'batchesPlanned': 0, 'batchesComplete': 0,
              'usage': {'inputTokens': 0, 'outputTokens': 0, 'totalTokens': 0}}
    for case in cases:
        for stage in stage_results(case, 'semantic'):
            requests = stage.get('requests')
            ids = [r['responseId'] for r in requests if r.get('responseId')] if requests else ([stage['responseId']] if stage.get('responseId') else [])
            result['providerResponsesRecorded'] += len(ids)
            result['scheduledRequestCount'] += len(requests) if requests else int(bool(ids))
            if requests:
                result['batchStrategyCases'] += 1
                result['batchSourceBytes'] += stage['batching']['sourceBytes']
                result['batchesPlanned'] += stage['batching']['planned']
                result['batchesComplete'] += stage['batching']['completed']
            for key in result['usage']:
                result['usage'][key] += stage.get('usage', {}).get(key, 0)
    result['requestCountBoundary'] = 'Legacy records without response metadata cannot prove whether a request was made; revised batch ledgers record scheduled requests, including errors.'
    return result


def validate_benchmark(data, corpus, corpus_bytes):
    require(data['corpusId'] == corpus['corpusId'], 'Corpus ID changed')
    require(data['corpusSha256'] == digest(corpus_bytes), 'Corpus manifest digest changed')
    require(data['configuration']['threshold'] == 'medium', 'Alert threshold changed')
    require(data['configuration']['retries'] == 0, 'Retry policy changed')
    require(data['configuration']['scannerVersion'] == '2.2.2', 'Cisco version changed')
    require(data['configuration']['semantic'] is True, 'Missing live semantic configuration')
    sample_map = unique(corpus['samples'], 'id', 'corpus IDs')
    case_map = unique([{'id': c['sample']['id'], 'case': c} for c in data['cases']], 'id', 'case IDs')
    require(set(case_map) == set(sample_map), 'Added or removed cases')
    require([c['sample']['id'] for c in data['cases']] == [s['id'] for s in corpus['samples']], 'Case order changed')
    freeze = data['freeze']
    unique(freeze['files'], 'path', 'source freeze paths')
    require(digest(packed(freeze['files'])) == freeze['sha256'], 'Invalid source freeze digest')
    require(not any('Source files changed during this run' in text for text in data.get('limitations', [])),
            'Source files changed during run')
    response_ids = []
    for case in data['cases']:
        sample = case['sample']; identity = sample['id']
        require(sample == sample_map[identity], f'Changed provenance, label or package: {identity}')
        require(bool(case.get('review')) != bool(case.get('error')), f'Missing or ambiguous case result: {identity}')
        if not case.get('review'):
            continue
        review = case['review']
        require(fingerprint(review['manifest']) == review['fingerprint'], f'Invalid snapshot fingerprint: {identity}')
        recorded = unique(review['manifest'], 'path', 'snapshot paths')
        root = skill_root(sample)
        source = {f['originalPath'][len(root):]: f for f in sample['files'] if f['originalPath'].startswith(root)}
        for name, entry in recorded.items():
            original = source.get(name)
            require(original is not None and entry['sha256'] == original['sha256'] and entry['size'] == original['bytes']
                    and entry['executable'] is False, f'Snapshot changed bytes: {identity}')
        if set(recorded) != set(source) or len(source) != len(sample['files']) or sample['packageCompleteness']['status'] != 'complete-preserved-snapshot':
            require(bool(review['coverage']['gaps']), f'Unacknowledged snapshot omission: {identity}')
        stages = unique(review['engines'], 'engine', 'engine names')
        expected = {'native', 'cisco', 'semantic'}
        require(set(stages) == expected and set(review['selectedEngines']) == expected
                and len(review['selectedEngines']) == 3, f'Selected engine mismatch: {identity}')
        require(all(stage['status'] in ('complete', 'partial', 'unsupported', 'error') for stage in stages.values()),
                f'Unrequested or invalid stage: {identity}')
        for stage in stages.values():
            require(not (stage['status'] == 'complete' and stage['errors']), f'Completed engine has errors: {identity}')
            for finding in stage['findings']:
                require(finding['engine'] == stage['engine'], f'Wrong finding engine: {identity}')
                require(all(e['file'] in recorded for e in finding['evidence']), f'Evidence outside snapshot: {identity}')
            if stage['engine'] == 'semantic':
                ids = validate_semantic_ledger(stage, identity)
                require(all(isinstance(i, str) and i.startswith('resp_') for i in ids), f'Invalid response ID: {identity}')
                response_ids.extend(ids)
                if stage.get('model'):
                    require(stage['model'] == 'gpt-6-luna', f'Unexpected model: {identity}')
        require(review['coverage']['files'] == len(recorded) and review['coverage']['readableFiles'] <= len(recorded), f'Invalid file coverage count: {identity}')
        require(review['coverage']['readableFiles'] == len(recorded) or review['coverage']['gaps'], f'Unread files without coverage gap: {identity}')
        require(stages['cisco']['status'] != 'complete' or stages['cisco']['version'] == '2.2.2', f'Wrong Cisco version: {identity}')
        complete = all(s['status'] == 'complete' for s in stages.values()) and not review['coverage']['gaps']
        expected_outcome = 'risk_detected' if detected(case) else 'no_alert' if complete else 'unverified'
        require(review['inspectionComplete'] == complete and review['outcome'] == expected_outcome,
                f'Invalid derived review outcome: {identity}')
    require(len(set(response_ids)) == len(response_ids), 'Reused response IDs within cohort')
    require(metrics(data['cases']) == data['metrics'], 'Recorded metrics differ from independent recomputation')
    return {'valid': True, 'cases': len(case_map), 'manifestSha256': digest(corpus_bytes),
            'sourceFreezeSha256': freeze['sha256'], 'uniqueResponsesRecorded': len(response_ids),
            'semanticWork': semantic_work(data['cases']),
            'sampleIdentitySha256': digest(packed(corpus['samples']))}


def audit_fixtures(repository, corpus_path, corpus):
    files = 0; bytes_count = 0
    for sample in corpus['samples']:
        for entry in sample['files']:
            base = corpus_path.parent.resolve(); file = base / entry['fixturePath']
            require(file.resolve().is_relative_to(base) and not file.is_symlink(), 'Unsafe fixture path')
            content = file.read_bytes()
            require(len(content) == entry['bytes'] and digest(content) == entry['sha256'], f'Corpus bytes changed: {sample["id"]}')
            files += 1; bytes_count += len(content)
    return {'verifiedFiles': files, 'verifiedBytes': bytes_count}


def case_summary(case, engine):
    review = case.get('review', {})
    return {'outcome': outcome(case, engine), 'observedAlertDespiteIncompleteness': bool(abstention(case, engine)) and detected(case, engine),
            'snapshotFingerprint': review.get('fingerprint'),
            'coverageGapCount': len(review.get('coverage', {}).get('gaps', [])),
            'stages': [{'engine': stage['engine'], 'status': stage['status'], 'errorCount': len(stage['errors']),
                        'alertRules': sorted({finding['rule'] for finding in stage['findings'] if finding['severity'] in ALERTS})}
                       for stage in stage_results(case, engine)]}


def compare_cohort(before, after):
    before_map = {c['sample']['id']: c for c in before['cases']}
    after_map = {c['sample']['id']: c for c in after['cases']}
    require(set(before_map) == set(after_map), 'Case identities changed across runs')
    require(before['configuration'] == after['configuration'], 'Benchmark configuration changed across runs')
    snapshot_missing = []
    for identity, case in before_map.items():
        other = after_map[identity]
        require(case['sample'] == other['sample'], f'Case labels or provenance changed: {identity}')
        if case.get('review') and other.get('review'):
            require(case['review']['manifest'] == other['review']['manifest'] and
                    case['review']['fingerprint'] == other['review']['fingerprint'], f'Inspected snapshot changed: {identity}')
        else:
            snapshot_missing.append(identity)
    output = {'sameCasesAndLabels': True, 'sameInspectedSnapshotsWherePresent': True,
              'missingSnapshotComparisonCaseIds': snapshot_missing,
              'semanticWork': {'before': semantic_work(before['cases']), 'after': semantic_work(after['cases'])}, 'engines': {}}
    for engine in ENGINES:
        paired = [identity for identity in before_map if outcome(before_map[identity], engine) in CLASSES
                  and outcome(after_map[identity], engine) in CLASSES]
        new = [identity for identity in before_map if abstention(before_map[identity], engine)
               and outcome(after_map[identity], engine) in CLASSES]
        lost = [identity for identity in before_map if outcome(before_map[identity], engine) in CLASSES
                and abstention(after_map[identity], engine)]
        transitions = Counter(f'{outcome(before_map[i], engine)} -> {outcome(after_map[i], engine)}' for i in before_map)
        all_rows = []
        for identity, case in before_map.items():
            all_rows.append({'id': identity, 'label': label(case), 'family': case['sample']['family'],
                             'provenanceKind': case['sample']['provenanceKind'],
                             'before': case_summary(case, engine), 'after': case_summary(after_map[identity], engine)})
        output['engines'][engine] = {
            'fullBefore': score(before['cases'], engine), 'fullAfter': score(after['cases'], engine),
            'pairedEligible': {'caseIds': paired, 'before': score([before_map[i] for i in paired], engine),
                               'after': score([after_map[i] for i in paired], engine)},
            'newlyEvaluable': {'caseIds': new, 'after': score([after_map[i] for i in new], engine)},
            'lostEvaluable': {'caseIds': lost, 'before': score([before_map[i] for i in lost], engine)},
            'transitions': dict(sorted(transitions.items())), 'cases': all_rows,
        }
    # Identical rows across all engines/runs avoid selection differences in ablations.
    common = [i for i in before_map if all(outcome(before_map[i], e) in CLASSES and outcome(after_map[i], e) in CLASSES for e in ENGINES)]
    output['commonAllEngineEligible'] = {'caseIds': common, 'engines': {
        e: {'before': score([before_map[i] for i in common], e), 'after': score([after_map[i] for i in common], e)} for e in ENGINES}}
    return output


def markdown_report(result):
    lines = ['# SkillGate development repair: before / after', '',
             'This is a tuned development-corpus rerun, not a blinded holdout or independent replication. Source labels are preserved; unknown cases are never counted as benign. Unsupported and incomplete cases stay outside TP/FP/TN/FN.', '',
             '| Cohort | Engine | Run | TP | FN | FP | TN | Incomplete | Completed unknown |',
             '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for cohort, comparison in result['cohorts'].items():
        for engine, record in comparison['engines'].items():
            for run in ['Before', 'After']:
                value = record[f'full{run}']
                lines.append(f'| {cohort} | {engine} | {run} | {value["tp"]} | {value["fn"]} | {value["fp"]} | {value["tn"]} | {value["incomplete"]} | {value["unknown"]} |')
        combined = comparison['engines']['combined']
        paired = combined['pairedEligible']; old = paired['before']; new = paired['after']
        lines += ['', f'## {cohort}: identical eligible rows', '',
                  f'{len(paired["caseIds"])} labelled rows are eligible in both runs. Combined before: TP {old["tp"]}, FN {old["fn"]}, FP {old["fp"]}, TN {old["tn"]}. After: TP {new["tp"]}, FN {new["fn"]}, FP {new["fp"]}, TN {new["tn"]}.',
                  f'Newly evaluable: {len(combined["newlyEvaluable"]["caseIds"])}. Lost evaluability: {len(combined["lostEvaluable"]["caseIds"])}. These do not enter the paired change estimate.', '', '| Transition | Cases |', '| --- | ---: |']
        lines += [f'| {transition} | {count} |' for transition, count in combined['transitions'].items()]
    lines += ['', '## Evidence boundary', '',
              'The JSON lists every case transition for every engine, paired row IDs, newly evaluable rows, all primary exclusions and all stage error counts. Complete source hashes and the original baseline artifacts are retained. This check verifies internal consistency and unchanged bytes; it does not establish ground-truth correctness, an untouched test set, or runtime prevention.', '',
              'An unchanged result after tuning is retained as a failure. A risk alert on an incomplete case remains an incomplete case. Source-label disputes do not modify labels. Model request counts may rise when coverage expands; differences in work performed are disclosed in the frozen repair protocol.']
    return '\n'.join(lines) + '\n'


def run(before_root, after_root, repository, output):
    require(not output.exists(), 'Output directory already exists; previous results must be preserved')
    result = {'version': 'skillgate-development-repair-comparison-v1',
              'createdAt': datetime.now(timezone.utc).isoformat(),
              'toolSha256': digest(Path(__file__).read_bytes()),
              'validation': {}, 'cohorts': {}}
    for cohort, relative in MANIFESTS.items():
        manifest_path = repository / relative; corpus_bytes = manifest_path.read_bytes(); corpus = json.loads(corpus_bytes)
        before_path = before_root / cohort / 'benchmark.json'; after_path = after_root / cohort / 'benchmark.json'
        before_bytes = before_path.read_bytes(); after_bytes = after_path.read_bytes()
        before = json.loads(before_bytes); after = json.loads(after_bytes)
        result['validation'][cohort] = {
            'before': validate_benchmark(before, corpus, corpus_bytes), 'after': validate_benchmark(after, corpus, corpus_bytes),
            'beforeArtifactSha256': digest(before_bytes), 'afterArtifactSha256': digest(after_bytes),
            'fixtures': audit_fixtures(repository, manifest_path, corpus),
        }
        result['cohorts'][cohort] = compare_cohort(before, after)
    output.mkdir(parents=True)
    (output / 'comparison.json').write_text(json.dumps(result, indent=2) + '\n')
    (output / 'comparison.md').write_text(markdown_report(result))
    print(json.dumps({'valid': True, 'cohorts': {key: {'before': value['engines']['combined']['fullBefore'], 'after': value['engines']['combined']['fullAfter']} for key, value in result['cohorts'].items()}}))
    return result


def selfcheck():
    def case(identity, ground='malicious', alert=False, status='complete', package='complete-preserved-snapshot'):
        return {'sample': {'id': identity, 'groundTruth': {'label': ground, 'independentOfSkillGate': True},
                           'packageCompleteness': {'status': package}, 'family': 'group', 'provenanceKind': 'synthetic',
                           'documentationUrl': 'https://example.test/source'},
                'review': {'selectedEngines': ['native', 'cisco', 'semantic'], 'fingerprint': 'same', 'manifest': [],
                           'coverage': {'gaps': []}, 'engines': [
                               {'engine': e, 'status': status if e == 'semantic' else 'complete', 'errors': [],
                                'findings': [{'severity': 'medium', 'rule': 'SYNTHETIC'}] if alert and e == 'native' else []}
                               for e in ('native', 'cisco', 'semantic')]}}
    rows = [case('tp', alert=True), case('fn'), case('fp', ground='benign', alert=True),
            case('tn', ground='benign'), case('u', ground='unknown', alert=True),
            case('i', alert=True, status='partial'), case('p', alert=True, package='partial-filtered')]
    value = score(rows)
    assert [value[k] for k in ('tp', 'fp', 'tn', 'fn', 'unknown', 'incomplete')] == [1, 1, 1, 1, 1, 2]
    assert value['abstentions']['partial'] == 1 and value['abstentions']['partialPackage'] == 1
    assert score([rows[0]])['accuracy'] is None and score([rows[0]])['precision'] is None
    assert outcome(rows[-2]) == 'INCOMPLETE:partial' and detected(rows[-2])
    before = {'cases': rows, 'configuration': {'frozen': True}}
    changed = copy.deepcopy(rows)
    changed[1]['review']['engines'][0]['findings'] = [{'severity': 'high', 'rule': 'SYNTHETIC'}]
    changed[-2]['review']['engines'][-1]['status'] = 'complete'
    changed[3]['review']['engines'][-1]['status'] = 'error'
    compared = compare_cohort(before, {'cases': changed, 'configuration': {'frozen': True}})
    combined = compared['engines']['combined']
    assert combined['transitions']['FN -> TP'] == 1
    assert combined['newlyEvaluable']['caseIds'] == ['i']
    assert combined['lostEvaluable']['caseIds'] == ['tn']
    assert combined['pairedEligible']['caseIds'] == ['tp', 'fn', 'fp']
    assert combined['pairedEligible']['before']['fn'] == 1 and combined['pairedEligible']['after']['fn'] == 0
    assert combined['fullAfter']['unknown'] == 1
    tampered = copy.deepcopy(changed); tampered[0]['sample']['groundTruth']['label'] = 'benign'
    try:
        compare_cohort(before, {'cases': tampered, 'configuration': {'frozen': True}})
    except ValueError:
        pass
    else:
        raise AssertionError('Changed labels accepted')
    tampered = copy.deepcopy(changed); tampered[0]['review']['fingerprint'] = 'changed'
    try:
        compare_cohort(before, {'cases': tampered, 'configuration': {'frozen': True}})
    except ValueError:
        pass
    else:
        raise AssertionError('Changed snapshot accepted')
    assert score([case('unknown', ground='unknown')])['tn'] == 0
    ledger = {'status': 'complete', 'transport': 'openai-responses',
              'requests': [{'batch': 1, 'inputSha256': '0' * 64, 'sourceIds': ['s0000001'], 'status': 'complete', 'errors': [],
                            'responseId': 'resp_test', 'model': 'gpt-6-luna', 'usage': {'inputTokens': 3, 'outputTokens': 2, 'totalTokens': 5}}],
              'batching': {'strategy': 'source-id-batches-v1', 'planned': 1, 'completed': 1},
              'responseId': 'resp_test', 'usage': {'inputTokens': 3, 'outputTokens': 2, 'totalTokens': 5}}
    assert validate_semantic_ledger(ledger, 'selfcheck') == ['resp_test']
    for field, replacement in [('transport', 'test-double'), ('usage', {'inputTokens': 2, 'outputTokens': 3, 'totalTokens': 5})]:
        bad = copy.deepcopy(ledger); bad[field] = replacement
        try:
            validate_semantic_ledger(bad, 'selfcheck')
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid live request provenance accepted')
    bad = copy.deepcopy(ledger); bad['requests'][0]['sourceIds'] = ['s0000002']
    try:
        validate_semantic_ledger(bad, 'selfcheck')
    except ValueError:
        pass
    else:
        raise AssertionError('Source coverage gap accepted')
    print(json.dumps({'selfcheck': 'passed', 'checks': ['confusion matrix', 'abstention precedence', 'unknown isolation', 'paired rows', 'new coverage', 'lost coverage', 'label tampering', 'snapshot tampering', 'request ledger and usage', 'mocked transport rejection', 'source coverage ID gaps'], 'providerCalls': 0}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before', type=Path); parser.add_argument('--after', type=Path)
    parser.add_argument('--repository', type=Path); parser.add_argument('--out', type=Path)
    parser.add_argument('--selfcheck', action='store_true')
    args = parser.parse_args()
    if args.selfcheck:
        selfcheck()
    else:
        parser.error('--before, --after, --repository and --out required') if not all([args.before, args.after, args.repository, args.out]) else None
        try:
            run(args.before, args.after, args.repository, args.out)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            print(json.dumps({'valid': False, 'error': str(error)}))
            raise SystemExit(2)
