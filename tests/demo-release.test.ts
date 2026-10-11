import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { addSkill, initProject } from '../packages/core/src/index.js';
import { replayLedger } from '../packages/demo/src/index.js';

test('downloadable demo is reproducible; extracted good skill installs and trap stays quarantined', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'honeyskill-demo-release-'));
  try {
    const prepare = () => execFileSync(process.execPath, ['scripts/prepare-demo.mjs', '--workspace', temporary], { encoding: 'utf8' });
    prepare();
    const archivePath = path.join(temporary, 'outputs/honeyskill-demo-skills-v0.1.0.zip');
    const first = await readFile(archivePath);
    prepare();
    assert.deepEqual(await readFile(archivePath), first, 'Identical input produces identical archive bytes');
    const manifest = JSON.parse(await readFile(path.join(temporary, 'outputs/demo-release-manifest.json'), 'utf8'));
    assert.equal(manifest.published, false);
    assert.equal(manifest.publicUrl, null);
    assert.equal(manifest.archive.sha256, createHash('sha256').update(first).digest('hex'));
    assert.equal(manifest.files.length, 5);
    const extracted = path.join(temporary, 'downloaded');
    execFileSync('python3', ['-c', 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', archivePath, extracted]);
    for (const file of manifest.files) {
      assert.match(file.path, /^(README\.md|skills\/portfolio-summary(?:-trap)?\/(SKILL\.md|actions\.json))$/);
      const data = await readFile(path.join(extracted, file.path));
      assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256);
    }
    const project = path.join(temporary, 'protected-project');
    await initProject(project, { profile: 'static' });
    const good = await addSkill(project, path.join(extracted, 'skills/portfolio-summary'));
    const trap = await addSkill(project, path.join(extracted, 'skills/portfolio-summary-trap'));
    assert.equal(good.report.decision, 'allow');
    assert.equal(good.installation?.status, 'installed');
    assert.equal(good.report.coverage.status, 'complete_for_supported_checks');
    assert.equal(trap.report.decision, 'hold');
    assert.equal(trap.installation, undefined);
    assert.deepEqual(await readdir(path.join(project, '.agents/skills')), ['portfolio-summary']);
    assert.ok(trap.report.findings.some(finding => finding.category === 'FIN-02'));
    assert.ok(trap.report.findings.some(finding => finding.category === 'FIN-06'));
    assert.ok((await realpath(good.installation!.target)).startsWith(await realpath(temporary)));
    const ledger = await replayLedger(good.installation!.target);
    assert.equal(ledger.ledger['demo-user'], 100);
    const baseline = await replayLedger(path.join(extracted, 'skills/portfolio-summary-trap'));
    assert.equal(baseline.ledger['demo-user'], 75);
    const held = await replayLedger(path.join(project, '.agents/skills/portfolio-summary-trap'));
    assert.equal(held.available, false);
    if (process.env.SKILLGATE_DEMO_EVIDENCE) await writeFile(process.env.SKILLGATE_DEMO_EVIDENCE, JSON.stringify({
      schemaVersion: 1, executedAt: new Date().toISOString(), command: 'SKILLGATE_DEMO_EVIDENCE=outputs/demo-release-evidence.json pnpm exec tsx --test tests/demo-release.test.ts',
      archive: manifest.archive, sourceType: manifest.sourceType, published: false, publicUrl: null,
      checks: { byteReproducible: true, extractedFileHashesVerified: true, sandboxRoot: temporary, sandboxRemovedAfterTest: true },
      legitimate: { decision: good.report.decision, installed: !!good.installation, report: good.report },
      trap: { decision: trap.report.decision, installed: false, absentFromActiveFolder: true, report: trap.report },
      ledger: { mode: 'deterministic simulation, not a model execution', realFunds: false, networkCalls: 0, baseline, protected: held, legitimate: ledger },
    }, null, 2) + '\n');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
