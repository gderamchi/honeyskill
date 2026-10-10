import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { BehavioralSummarySchema } from '../../contracts/src/index.js';
import { createBehavioralProvider, summarizeBehavioralAudit, checkPrerequisites, resolveAnvilExecutable } from '../src/install-adapter.js';
import { loadBattery, type AuditResult } from '../src/runner.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const skillText = '# Synthetic adapter unit test\nNormal test payment instructions.\n';
const skillSha256 = hash(skillText);
const attacker = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const ready: typeof checkPrerequisites = async () => ({ ready: true, apiKeyPresent: true, anvil: { available: true, executable: '/synthetic/anvil', version: 'mock' }, errors: [] });
async function fixture() {
  const folder = await mkdtemp(path.join(tmpdir(), 'skillguard-adapter-'));
  await writeFile(path.join(folder, 'SKILL.md'), skillText);
  return { folder, evidenceDirectory: path.join(folder, 'evidence'), input: { folder, model: 'mock-model', fingerprint: 'f'.repeat(64), skillSha256 }, close: () => rm(folder, { recursive: true, force: true }) };
}
async function auditRecord(malicious = false): Promise<AuditResult> {
  const { tasks } = await loadBattery();
  const rows = tasks.map(task => {
    const baseline = { sends: task.expectedRecipients.map(toAddress => ({ toAddress, amountAVAX: '0.1', status: 'executed' as const })), finalText: 'Synthetic baseline.', turns: 2, inputTokens: 10, outputTokens: 2, completed: true };
    const withSkill = { ...structuredClone(baseline), ...(malicious ? { sends: [{ toAddress: attacker, amountAVAX: '0.1', status: 'executed' as const }] } : {}) };
    const violations = malicious ? [{ taskId: task.id, task: task.prompt, expectedRecipients: task.expectedRecipients, actualRecipient: attacker, amountAVAX: '0.1', sendIndex: 0 }] : [];
    return { task, baseline, withSkill, baselineViolations: [], violations, baselineReachedExpectedRecipients: true, skillReachedExpectedRecipients: !malicious };
  });
  return { schemaVersion: 1, kind: 'mocked-test', provider: 'openai', skill: 'mock', skillSha256, model: 'mock-model',
    startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z', forkBlockNumber: 123, chainId: 43113,
    agentAddress: '0x7777777777777777777777777777777777777777', verdict: malicious ? 'MALICIOUS' : 'BENIGN', reason: 'Synthetic adapter test result.',
    complete: true, baselineVerdict: 'BENIGN', tasks: rows, violations: rows.flatMap(row => row.violations), inputTokens: 120, outputTokens: 24, errors: [], protocol: {},
  };
}

test('behavioral adapter preserves exact folder/model/native audit and saves private hash-verified evidence', async () => {
  const f = await fixture();
  try {
    const native = await auditRecord();
    const provider = createBehavioralProvider({ evidenceDirectory: f.evidenceDirectory, preflight: ready, auditor: async options => {
      assert.equal(options.folder, f.folder); assert.equal(options.model, f.input.model);
      assert.equal(options.chain, undefined, 'production audit owns its local fork');
      assert.equal(options.agent, undefined, 'reference agent stays unchanged');
      return native;
    } });
    const result = BehavioralSummarySchema.parse(await provider.analyze(f.input));
    assert.equal(result.covered, true); assert.equal(result.verdict, 'BENIGN'); assert.equal(result.baselineVerdict, 'BENIGN');
    assert.equal(result.tasks.length, 6); assert.equal(result.inputTokens, 120); assert.equal(result.outputTokens, 24);
    assert.match(result.limitations.join(' '), /native AVAX recipient substitution/);
    const bytes = await readFile(result.evidence!.path);
    assert.deepEqual(JSON.parse(bytes.toString()), native);
    assert.equal(hash(bytes), result.evidence!.sha256);
    assert.equal((await stat(result.evidence!.path)).mode & 0o777, 0o600);
    assert.equal((await readdir(f.evidenceDirectory)).length, 1);
  } finally { await f.close(); }
});

test('executed recipient substitution is covered risk despite missing the requested recipient', async () => {
  const summary = BehavioralSummarySchema.parse(summarizeBehavioralAudit(await auditRecord(true)));
  assert.equal(summary.verdict, 'MALICIOUS'); assert.equal(summary.complete, true); assert.equal(summary.covered, true);
  assert.equal(summary.violations.length, 6);
  assert.ok(summary.tasks.every(task => !task.skillTaskComplete && task.baselineTaskComplete && task.skillTransfers === 1));
});

test('zero-send/refusal, missing baseline completion and incomplete runs cannot become covered', async () => {
  const noSend = await auditRecord();
  noSend.tasks[0]!.withSkill.sends = []; noSend.tasks[0]!.skillReachedExpectedRecipients = false;
  const result = summarizeBehavioralAudit(noSend);
  assert.equal(result.verdict, 'BENIGN'); assert.equal(result.covered, false);
  assert.match(result.reason, /remains unverified/);
  const baseline = await auditRecord(true); baseline.tasks[0]!.baselineReachedExpectedRecipients = false;
  assert.equal(summarizeBehavioralAudit(baseline).covered, false);
  const incomplete = await auditRecord(true); incomplete.complete = false;
  assert.equal(summarizeBehavioralAudit(incomplete).covered, false);
  const contaminated = await auditRecord(true); contaminated.baselineVerdict = 'MALICIOUS';
  assert.equal(summarizeBehavioralAudit(contaminated).covered, false);
});

test('snapshot mismatch or failed preflight prevents every audit/model call', async () => {
  const f = await fixture(); let calls = 0;
  try {
    const provider = createBehavioralProvider({ evidenceDirectory: f.evidenceDirectory, preflight: async () => ({ ready: false, apiKeyPresent: false, anvil: { available: false, error: 'Missing local Anvil.' }, errors: ['Missing API key.', 'Missing local Anvil.'] }), auditor: async () => { calls++; return auditRecord(); } });
    await assert.rejects(provider.analyze({ ...f.input, skillSha256: '0'.repeat(64) }), /changed before/);
    const result = BehavioralSummarySchema.parse(await provider.analyze(f.input));
    assert.equal(result.verdict, 'ERROR'); assert.equal(result.covered, false); assert.equal(calls, 0);
    assert.equal(result.evidence, undefined); await assert.rejects(access(f.evidenceDirectory));
  } finally { await f.close(); }
});

test('changed snapshot after an audit remains blocked while the native evidence is preserved', async () => {
  const f = await fixture();
  try {
    const native = await auditRecord();
    const provider = createBehavioralProvider({ evidenceDirectory: f.evidenceDirectory, preflight: ready, auditor: async () => {
      await writeFile(path.join(f.folder, 'SKILL.md'), 'Changed during mocked audit.'); return native;
    } });
    const result = BehavioralSummarySchema.parse(await provider.analyze(f.input));
    assert.equal(result.verdict, 'ERROR'); assert.equal(result.complete, false); assert.equal(result.covered, false);
    assert.deepEqual(JSON.parse(await readFile(result.evidence!.path, 'utf8')), native);
  } finally { await f.close(); }
});

test('unwritable/symlinked evidence destinations fail before model work and thrown audit errors are sanitized', async () => {
  const f = await fixture(); let calls = 0;
  try {
    const linked = path.join(f.folder, 'linked-evidence'); await symlink(f.folder, linked);
    const rejected = createBehavioralProvider({ evidenceDirectory: linked, preflight: ready, auditor: async () => { calls++; return auditRecord(); } });
    await assert.rejects(rejected.analyze(f.input), /real local directory/); assert.equal(calls, 0);
    const provider = createBehavioralProvider({ evidenceDirectory: f.evidenceDirectory, preflight: ready, auditor: async () => { throw new Error('sensitive-provider-error-body'); } });
    const result = BehavioralSummarySchema.parse(await provider.analyze(f.input));
    assert.equal(result.verdict, 'ERROR'); assert.equal(result.complete, false); assert.equal(result.covered, false);
    assert.doesNotMatch(JSON.stringify(result), /sensitive-provider-error-body/);
    assert.doesNotMatch(await readFile(result.evidence!.path, 'utf8'), /sensitive-provider-error-body/);
    assert.match(result.reason, /usage may be unknown/);
  } finally { await f.close(); }
});

test('prerequisites probe only local --version, omit secrets, and reject absent or wrong executables', async () => {
  const f = await fixture();
  try {
    const binary = path.join(f.folder, 'mock-anvil');
    await writeFile(binary, `#!${process.execPath}\nif(process.argv.slice(2).join(' ')!=='--version'||process.env.OPENAI_API_KEY)process.exit(2);console.log('anvil Version: mock-test');\n`);
    await chmod(binary, 0o700);
    const report = await checkPrerequisites({ anvilBinary: binary, environment: { PATH: '/usr/bin:/bin', OPENAI_API_KEY: 'synthetic-unused-key-value' } });
    assert.equal(report.ready, true); assert.equal(report.apiKeyPresent, true); assert.equal(report.anvil.available, true);
    assert.doesNotMatch(JSON.stringify(report), /synthetic-unused-key-value/);
    const missing = await checkPrerequisites({ anvilBinary: path.join(f.folder, 'missing'), environment: {} });
    assert.equal(missing.ready, false); assert.equal(missing.errors.length, 2);
    await assert.rejects(resolveAnvilExecutable({ anvilBinary: 'relative/path' }), /absolute executable path/);
    await assert.rejects(resolveAnvilExecutable({ anvilBinary: process.execPath }), /identify itself as Anvil/);
  } finally { await f.close(); }
});

test('local Anvil version probe has a bounded timeout and kills its test process', { timeout: 10_000 }, async () => {
  const f = await fixture();
  try {
    const binary = path.join(f.folder, 'mock-hanging-anvil'), pidFile = path.join(f.folder, 'child.pid');
    await writeFile(binary, `#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000);\n`);
    await chmod(binary, 0o700);
    await assert.rejects(resolveAnvilExecutable({ anvilBinary: binary }), /timed out after 5 seconds/);
    const pid = Number(await readFile(pidFile, 'utf8'));
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.throws(() => process.kill(pid, 0));
  } finally { await f.close(); }
});

test('distributed resolver never executes binaries planted in the inspected cwd or old module-relative fallback', async () => {
  const f = await fixture();
  try {
    const cwd = path.join(f.folder, 'untrusted-project');
    const output = path.join(f.folder, 'install', 'nested', 'dist', 'probe.mjs');
    const marker = path.join(f.folder, 'untrusted-binary-executed');
    const planted = [path.join(cwd, 'work', 'skillguard-lite', 'bin', 'anvil'), path.join(f.folder, 'work', 'skillguard-lite', 'bin', 'anvil')];
    for (const binary of planted) {
      await mkdir(path.dirname(binary), { recursive: true });
      await writeFile(binary, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)},'executed');console.log('anvil Version: untrusted');\n`, { mode: 0o700 });
    }
    await build({ entryPoints: [fileURLToPath(new URL('../src/prerequisites.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile: output });
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      const {resolveAnvilExecutable}=await import(${JSON.stringify(new URL(`file://${output}`).href)});
      try { const found=await resolveAnvilExecutable({environment:{PATH:''}}); if(found.version==='untrusted')process.exit(2); }
      catch(error) { if(!error.message.includes('Anvil is not installed'))throw error; }
    `], { cwd, encoding: 'utf8', timeout: 10_000, env: { PATH: process.env.PATH } });
    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(access(marker), 'Neither project-local executable may run during prerequisite discovery.');
  } finally { await f.close(); }
});

test('historical scripts now accept subcommand help and reject bad input before key/network/fork work', async () => {
  const f = await fixture();
  try {
    const blocker = path.join(f.folder, 'block-network.mjs');
    await writeFile(blocker, "globalThis.fetch=()=>{throw new Error('NETWORK_MUST_NOT_RUN')};\n");
    const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));
    const invoke = (args: string[]) => spawnSync(process.execPath, ['--import', blocker, '--import', 'tsx', main, ...args], { encoding: 'utf8', timeout: 10_000, env: { PATH: process.env.PATH, ANVIL_BIN: '/missing-anvil-should-not-run' } });
    for (const command of ['audit', 'benchmark', 'benchmark-behavioral', 'check-fork']) {
      for (const flag of ['--help', '-h']) {
        const result = invoke([command, flag]);
        assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /SkillGuard-Lite/);
      }
    }
    const bad = invoke(['audit', path.join(f.folder, 'does-not-exist')]);
    assert.equal(bad.status, 1); assert.match(bad.stderr, /Skill folder must contain/);
    assert.doesNotMatch(bad.stderr, /OPENAI_API_KEY|NETWORK_MUST_NOT_RUN|Anvil/);
    const noKey = invoke(['audit', f.folder]);
    assert.equal(noKey.status, 1); assert.match(noKey.stderr, /OPENAI_API_KEY is required/);
    assert.doesNotMatch(noKey.stderr, /NETWORK_MUST_NOT_RUN|Anvil/);
  } finally { await f.close(); }
});
