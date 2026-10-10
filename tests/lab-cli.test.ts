import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ScanReportSchema } from '../packages/contracts/src/index.js';

const entry = path.resolve('apps/cli/src/index.ts');
const loader = import.meta.resolve('tsx');
async function setup(t: TestContext) {
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'skillgate-lab-cli-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const source = path.join(cwd, 'source'); await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'SKILL.md'), '---\nname: cli-lab-test\ndescription: Summarize the requested payment.\n---\nUse clear descriptions for the user-requested AVAX payment.\n');
  return { cwd, source };
}
function cli(cwd: string, args: string[]) {
  return spawnSync(process.execPath, ['--import', loader, entry, ...args], { cwd, encoding: 'utf8', timeout: 20_000,
    // Empty key and deliberately nonexistent binary guarantee no provider/fork call in subprocess tests.
    env: { ...process.env, NO_COLOR: '1', OPENAI_API_KEY: '', ANVIL_BIN: path.join(cwd, 'no-anvil-for-cli-test') } });
}

test('lab and try help are discoverable and do not initialize a lab', async t => {
  const { cwd } = await setup(t);
  const main = cli(cwd, ['--help']); assert.equal(main.status, 0, main.stderr); assert.match(main.stdout, /try \[options\] <source>/); assert.match(main.stdout, /lab/);
  for (const command of ['lab', 'try']) {
    const help = cli(cwd, [command, '--help']); assert.equal(help.status, 0, help.stderr); assert.match(help.stdout, /--lab/);
  }
  assert.equal(existsSync(path.join(cwd, 'skillgate-lab')), false);
});

test('lab JSON preflight creates only the isolated child and reports missing requirements honestly', async t => {
  const { cwd } = await setup(t);
  const result = cli(cwd, ['lab', '--json']); assert.equal(result.status, 3, result.stderr); assert.equal(result.stderr, '');
  const value = JSON.parse(result.stdout);
  assert.equal(value.root, path.join(cwd, 'skillgate-lab')); assert.equal(value.model, 'gpt-6-luna'); assert.equal(value.ready, false); assert.equal(value.apiKeyPresent, false); assert.equal(value.anvil.available, false);
  assert.equal(existsSync(path.join(cwd, '.skillgate')), false); assert.equal(existsSync(path.join(cwd, '.agents')), false);
  assert.equal(JSON.parse(await fs.readFile(path.join(value.root, '.skillgate', 'config.json'), 'utf8')).profile, 'full');
});

test('try without API returns native complete, semantic unavailable, execution failed and saves reports without activation', async t => {
  const { cwd, source } = await setup(t);
  const result = cli(cwd, ['try', source, '--json']);
  assert.equal(result.status, 3, result.stderr + result.stdout); assert.equal(result.stderr, '');
  const value = JSON.parse(result.stdout), report = ScanReportSchema.parse(value.report);
  assert.equal(value.status, 'unverified'); assert.equal(value.installation, undefined);
  assert.equal(report.profile, 'full'); assert.equal(report.decision, 'review');
  assert.equal(report.analyses.find(stage => stage.stage === 'native')?.status, 'completed');
  assert.equal(report.analyses.find(stage => stage.stage === 'semantic')?.status, 'unavailable');
  assert.equal(report.analyses.find(stage => stage.stage === 'behavioral')?.status, 'failed');
  assert.equal(report.behavioral?.verdict, 'ERROR'); assert.equal(report.behavioral?.tasks.length, 0);
  assert.ok(report.behavioral?.errors.some(error => error.includes('OPENAI_API_KEY is missing')));
  assert.equal(existsSync(path.join(value.lab, '.agents', 'skills', report.name)), false);
  assert.deepEqual(JSON.parse(await fs.readFile(value.reports.json, 'utf8')), report);
  assert.match(await fs.readFile(value.reports.markdown, 'utf8'), /UNAVAILABLE/);
  assert.match(await fs.readFile(value.reports.html, 'utf8'), /Execution INCOMPLETE/);
  const outcome = JSON.parse(await fs.readFile(path.join(value.lab, 'reports', `${report.id}.outcome.json`), 'utf8'));
  assert.equal(outcome.status, 'unverified'); assert.equal(outcome.report.behavioral.verdict, 'ERROR');
  assert.doesNotMatch(result.stdout, /Your choice|API key \(hidden/);
});

test('public good and trap command aliases stay unverified without API and never touch an explicit project', async t => {
  const { cwd } = await setup(t);
  const project = path.join(cwd, 'real-project'); await fs.mkdir(project); await fs.writeFile(path.join(project, 'package.json'), '{}');
  for (const alias of ['good', 'trap']) {
    const lab = path.join(cwd, `isolated-${alias}`);
    const result = cli(cwd, ['--project', project, 'try', alias, '--lab', lab, '--json']);
    assert.equal(result.status, 3, result.stderr + result.stdout); assert.equal(result.stderr, '');
    const value = JSON.parse(result.stdout); assert.equal(value.lab, lab); assert.equal(value.status, 'unverified');
    assert.equal(existsSync(path.join(lab, '.skillgate', 'examples', alias, 'SKILL.md')), true);
    assert.equal(existsSync(path.join(lab, '.agents', 'skills', value.report.name)), false);
    assert.equal(existsSync(path.join(project, '.skillgate')), false); assert.equal(existsSync(path.join(project, '.agents')), false);
  }
  const refused = cli(cwd, ['try', 'good', '--lab', project, '--json']); assert.equal(refused.status, 1);
  assert.match(JSON.parse(refused.stdout).error, /not empty/); assert.equal(existsSync(path.join(project, '.skillgate-lab.json')), false);
});
