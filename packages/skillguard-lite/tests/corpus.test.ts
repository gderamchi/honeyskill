import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadCorpus, validateCorpusIdentifier } from '../src/corpus.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const datasetHash = (files: Record<string, string>) => hash(JSON.stringify(Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))));
const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));

async function temporaryCorpus(identifier = 'realistic-v2') {
  const root = await mkdtemp(path.join(tmpdir(), 'skillguard-corpus-'));
  const directory = identifier === 'fixtures' ? 'fixtures' : `corpora/${identifier}`;
  const manifest = { schemaVersion: 1, kind: 'synthetic', attackerAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', provenance: 'Synthetic unit-test input.', fixtures: [
    { id: 'case-a', folder: 'case-a', label: 'benign', metadata: 'Not passed to the model.' },
    { id: 'case-b', folder: 'case-b', label: 'malicious', metadata: 'Synthetic label only.' },
  ] };
  const put = async (file: string, value: string) => { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), value); };
  await put('data/address-book.json', '[]\n');
  await put('data/tasks.json', '[]\n');
  await put(`${directory}/case-a/SKILL.md`, 'Harmless synthetic input A.\n');
  await put(`${directory}/case-b/SKILL.md`, 'Harmless synthetic input B; malicious label exercises validation only.\n');
  const files: Record<string, string> = {};
  const freeze = { schemaVersion: 1, files, datasetSha256: '', labels: Object.fromEntries(manifest.fixtures.map(f => [f.id, f.label])) };
  const writeFreeze = async () => {
    freeze.datasetSha256 = datasetHash(freeze.files);
    await put(`${directory}/freeze.json`, JSON.stringify(freeze));
  };
  const rebuild = async () => {
    await put(`${directory}/manifest.json`, JSON.stringify(manifest));
    for (const key of Object.keys(files)) delete files[key];
    for (const file of ['data/address-book.json', 'data/tasks.json', `${directory}/manifest.json`, ...manifest.fixtures.map(f => `${directory}/${f.folder}/SKILL.md`)]) files[file] = hash(await readFile(path.join(root, file)));
    freeze.labels = Object.fromEntries(manifest.fixtures.map(f => [f.id, f.label]));
    await writeFreeze();
  };
  await rebuild();
  return { root, directory, manifest, freeze, put, rebuild, writeFreeze, close: () => rm(root, { recursive: true, force: true }) };
}

test('the unchanged original 12-fixture freeze remains the default corpus', async () => {
  const corpus = await loadCorpus();
  assert.equal(corpus.identifier, 'fixtures');
  assert.equal(corpus.manifest.fixtures.length, 12);
  assert.equal(corpus.freeze.datasetSha256, '7e685d3130121193ea2f15551943b007467242a550a7cc4b9c4a31d51d1d408e');
});

test('named and default temporary corpora verify exact bytes, labels and canonical digest with extra metadata', async () => {
  for (const identifier of ['realistic-v2', 'fixtures']) {
    const fixture = await temporaryCorpus(identifier);
    try {
      const corpus = await loadCorpus(identifier, fixture.root);
      assert.equal(corpus.folder, path.join(fixture.root, fixture.directory));
      assert.equal(corpus.manifest.provenance, 'Synthetic unit-test input.');
      assert.equal(corpus.manifest.fixtures[0]?.metadata, 'Not passed to the model.');
      assert.equal(corpus.freeze.datasetSha256, datasetHash(fixture.freeze.files));
    } finally { await fixture.close(); }
  }
});

test('slug/path validation rejects traversal, absolute paths, empty and ambiguous identifiers', async () => {
  for (const value of ['', '../fixtures', '/tmp/corpus', 'corpora/other', 'a\\b', 'Uppercase', '-leading', 'trailing-', 'two--hyphens', 'x'.repeat(81)]) {
    assert.throws(() => validateCorpusIdentifier(value), /--corpus must be/);
    await assert.rejects(loadCorpus(value, '/unused-root'), /--corpus must be/);
  }
  const fixture = await temporaryCorpus();
  try {
    fixture.manifest.fixtures[0]!.folder = '../escape';
    await fixture.put(`${fixture.directory}/manifest.json`, JSON.stringify(fixture.manifest));
    await assert.rejects(loadCorpus('realistic-v2', fixture.root));
  } finally { await fixture.close(); }
});

test('freeze rejects missing coverage, extra paths, mismatched labels and forged dataset digests', async () => {
  const changes = [
    (f: Awaited<ReturnType<typeof temporaryCorpus>>) => { delete f.freeze.files['data/tasks.json']; },
    (f: Awaited<ReturnType<typeof temporaryCorpus>>) => { delete f.freeze.files['data/address-book.json']; },
    (f: Awaited<ReturnType<typeof temporaryCorpus>>) => { delete f.freeze.files[`${f.directory}/manifest.json`]; },
    (f: Awaited<ReturnType<typeof temporaryCorpus>>) => { delete f.freeze.files[`${f.directory}/case-b/SKILL.md`]; },
    (f: Awaited<ReturnType<typeof temporaryCorpus>>) => { f.freeze.files['../outside'] = '0'.repeat(64); },
    (f: Awaited<ReturnType<typeof temporaryCorpus>>) => { f.freeze.labels['case-a'] = 'malicious'; },
    (f: Awaited<ReturnType<typeof temporaryCorpus>>) => { f.freeze.labels['unselected-case'] = 'benign'; },
  ];
  for (const change of changes) {
    const fixture = await temporaryCorpus();
    try {
      change(fixture); await fixture.writeFreeze();
      await assert.rejects(loadCorpus('realistic-v2', fixture.root), /Freeze must cover exactly|Frozen labels do not match/);
    } finally { await fixture.close(); }
  }
  const fixture = await temporaryCorpus();
  try {
    fixture.freeze.datasetSha256 = '0'.repeat(64);
    await fixture.put(`${fixture.directory}/freeze.json`, JSON.stringify(fixture.freeze));
    await assert.rejects(loadCorpus('realistic-v2', fixture.root), /canonical file-hash map/);
  } finally { await fixture.close(); }
});

test('changed selected skill, manifest or shared task/book bytes fail verification', async () => {
  for (const changed of ['case-a/SKILL.md', 'manifest.json', 'data/tasks.json', 'data/address-book.json']) {
    const fixture = await temporaryCorpus();
    try {
      const file = changed.startsWith('data/') ? changed : `${fixture.directory}/${changed}`;
      await fixture.put(file, (await readFile(path.join(fixture.root, file), 'utf8')) + ' ');
      await assert.rejects(loadCorpus('realistic-v2', fixture.root), /Frozen dataset changed/);
    } finally { await fixture.close(); }
  }
});

test('duplicate IDs/folders, unlisted fixture directories and symlinked skills are rejected', async () => {
  for (const field of ['id', 'folder'] as const) {
    const fixture = await temporaryCorpus();
    try {
      fixture.manifest.fixtures[1]![field] = fixture.manifest.fixtures[0]![field];
      await fixture.rebuild();
      await assert.rejects(loadCorpus('realistic-v2', fixture.root), /must be unique/);
    } finally { await fixture.close(); }
  }
  const fixture = await temporaryCorpus();
  try {
    await fixture.put(`${fixture.directory}/unselected/SKILL.md`, 'Not selected.');
    await assert.rejects(loadCorpus('realistic-v2', fixture.root), /folders do not match/);
    await rm(path.join(fixture.root, fixture.directory, 'unselected'), { recursive: true });
    const file = `${fixture.directory}/case-a/SKILL.md`;
    await fixture.put('external.md', await readFile(path.join(fixture.root, file), 'utf8'));
    await rm(path.join(fixture.root, file));
    await symlink(path.join(fixture.root, 'external.md'), path.join(fixture.root, file));
    await assert.rejects(loadCorpus('realistic-v2', fixture.root), /without symlinks/);
  } finally { await fixture.close(); }
});

test('CLI limits --corpus to benchmarks and verifies a missing corpus before network/fork work', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'skillguard-corpus-cli-'));
  try {
    const blocker = path.join(root, 'block-network.mjs');
    await writeFile(blocker, "globalThis.fetch = () => { throw new Error('NETWORK_MUST_NOT_BE_CALLED'); };\n");
    const invoke = (args: string[]) => spawnSync(process.execPath, ['--import', blocker, '--import', 'tsx', main, ...args], {
      encoding: 'utf8', timeout: 10_000, env: { ...process.env, OPENAI_API_KEY: 'synthetic-unused-key', ANVIL_BIN: '/nonexistent-anvil-must-not-be-started' },
    });
    for (const command of ['audit', 'check-fork']) {
      const result = invoke([command, '--corpus', 'realistic-v2']);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /--corpus is supported only/);
    }
    const unsafe = invoke(['benchmark', '--corpus', '../fixtures']);
    assert.equal(unsafe.status, 1);
    assert.match(unsafe.stderr, /--corpus must be/);
    for (const command of ['benchmark', 'benchmark-behavioral']) {
      const output = path.join(root, `${command}.json`);
      const result = invoke([command, '--corpus', 'missing-unit-test-corpus', '--out', output]);
      assert.equal(result.status, 1);
      assert.doesNotMatch(result.stderr, /NETWORK_MUST_NOT_BE_CALLED|Unable to start Anvil/);
      const report = JSON.parse(await readFile(output, 'utf8'));
      assert.equal(report.corpus, 'missing-unit-test-corpus');
      assert.equal(report.complete, false);
      assert.match(report.error, /ENOENT/);
      assert.match(await readFile(output.replace('.json', '.md'), 'utf8'), /Benchmark not started/);
    }
    const help = invoke(['--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Corpus defaults to fixtures \(the original 12\)/);
    assert.match(help.stdout, /--corpus realistic-v2/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
