import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const invoke = (file: string) => spawnSync(process.execPath, ['--import', 'tsx', main, 'benchmark', '--out', file], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, OPENAI_API_KEY: 'synthetic-unused-test-key', ANVIL_BIN: '/nonexistent-anvil-must-not-be-started' } });
test('an existing JSON report is rejected before any model or fork execution and remains untouched', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sgl-output-'));
  try {
    const file = path.join(dir, 'report.json'); await writeFile(file, 'original evidence');
    const result = invoke(file);
    assert.equal(result.status, 1); assert.match(result.stderr, /EEXIST/); assert.doesNotMatch(result.stderr, /Anvil|OpenAI API/);
    assert.equal(await readFile(file, 'utf8'), 'original evidence');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('an existing benchmark table prevents execution before spending and preserves both explanations', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sgl-output-'));
  try {
    const file = path.join(dir, 'report.json'), table = path.join(dir, 'report.md'); await writeFile(table, 'original table');
    const result = invoke(file);
    assert.equal(result.status, 1); assert.match(result.stderr, /no execution started/); assert.doesNotMatch(result.stderr, /Anvil|OpenAI API/);
    assert.equal(await readFile(table, 'utf8'), 'original table');
    const evidence = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(evidence.complete, false); assert.match(evidence.error, /no execution started/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
