import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { url: { type: 'string' }, checksums: { type: 'string' } } });
assert.ok(values.url && values.checksums, 'Usage: node scripts/public-package-smoke.mjs --url PUBLIC_TGZ_URL --checksums PUBLIC_SHA256SUMS_URL');
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('outputs', { recursive: true });
const root = await mkdtemp(join(tmpdir(), 'skillgate-public-package-'));
const project = join(root, 'isolated-project'), prefix = join(root, 'prefix'), originalTools = join(root, 'original-tools');
await Promise.all([mkdir(project), mkdir(originalTools)]);
const publicRequests = [], commands = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function publicDownload(url) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.username + parsed.password, '', 'Anonymous URLs only.');
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  publicRequests.push({ requestedUrl: url, status: response.status, authentication: 'none' });
  assert.equal(response.status, 200, `Anonymous download failed: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length < 30 * 1024 * 1024, 'Unexpectedly large release asset.');
  return bytes;
}
const [archiveBytes, checksumsBytes] = await Promise.all([publicDownload(values.url), publicDownload(values.checksums)]);
const artifactName = basename(new URL(values.url).pathname);
const checksumLine = checksumsBytes.toString('utf8').split(/\r?\n/).map(line => /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line)).find(match => match?.[2] === artifactName);
assert.ok(checksumLine, `No checksum for ${artifactName}`);
const checksum = sha256(archiveBytes);
assert.equal(checksum, checksumLine[1], 'Anonymous artifact matches the independently downloaded checksum.');
const artifact = join(root, artifactName);
await writeFile(artifact, archiveBytes, { mode: 0o600 });
const publishedManifest = JSON.parse(execFileSync('tar', ['-xOf', artifact, 'package/package.json'], { encoding: 'utf8' }));
assert.equal(publishedManifest.name, manifest.name);
assert.equal(publishedManifest.version, manifest.version);
assert.equal(publishedManifest.dependencies, undefined, 'Public CLI must be self contained.');
const verifiedCliBytes = execFileSync('tar', ['-xOf', artifact, 'package/cli.js'], { maxBuffer: 8 * 1024 * 1024 });

// Empty npm configuration and a new cache prevent the test using the operator's registry credentials.
const npmUserconfig = join(root, 'npm-userconfig'), npmGlobalconfig = join(root, 'npm-globalconfig');
await Promise.all([writeFile(npmUserconfig, ''), writeFile(npmGlobalconfig, '')]);
const cleanEnv = {
  PATH: process.env.PATH, ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
  NO_COLOR: '1', OPENAI_API_KEY: '',
  npm_config_userconfig: npmUserconfig, npm_config_globalconfig: npmGlobalconfig,
  npm_config_cache: join(root, 'npm-cache'), npm_config_update_notifier: 'false',
};
function run(command, args, { expected = 0, cwd = root, env = cleanEnv, timeout = 60_000 } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
  commands.push({ command, args, exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, expected, `${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}
run('npm', ['install', '--global', '--prefix', prefix, values.url, '--ignore-scripts', '--no-audit', '--no-fund'], { timeout: 120_000 });
const bin = join(prefix, 'bin/skillgate');
const installedDirectory = join(prefix, 'lib/node_modules', manifest.name);
const installedCli = join(installedDirectory, 'cli.js');
const installedManifest = JSON.parse(await readFile(join(installedDirectory, 'package.json'), 'utf8'));
assert.equal(installedManifest.version, publishedManifest.version);
assert.equal(sha256(await readFile(installedCli)), sha256(verifiedCliBytes), 'The URL installation used the verified public CLI bytes.');
assert.equal(run(bin, ['--version']).stdout.trim(), manifest.version);
const upstreamLog = join(root, 'upstream-executed.log');
for (const command of ['npx', 'pnpm', 'skills']) await writeFile(join(originalTools, command), `#!${process.execPath}\nrequire('node:fs').appendFileSync(${JSON.stringify(upstreamLog)}, 'unexpected upstream execution\\n'); process.exit(91);\n`, { mode: 0o700 });
const terminalEnv = { ...cleanEnv, PATH: `${originalTools}${delimiter}${cleanEnv.PATH}` };
const demoRepo = 'gderamchi/skillgate-demo-skills';
const shellScript = 'eval "$("$1" --project "$2" enable)"\nnpx skills add "$3" --skill "$4" --agent codex';
const clean = run('/bin/sh', ['-c', shellScript, 'skillgate-public-smoke', bin, project, demoRepo, 'portfolio-summary'], { cwd: project, env: terminalEnv });
assert.match(clean.stdout, /Installé automatiquement/);
const trap = run('/bin/sh', ['-c', shellScript, 'skillgate-public-smoke', bin, project, demoRepo, 'portfolio-summary-trap'], { cwd: project, env: terminalEnv, expected: 2 });
assert.match(trap.stdout, /Retenu avant activation/);
assert.doesNotMatch(clean.stdout + clean.stderr + trap.stdout + trap.stderr, /Votre choix/);
assert.deepEqual(await readdir(join(project, '.agents/skills')), ['portfolio-summary']);
await assert.rejects(access(upstreamLog), 'Intercepted commands must never execute upstream.');
const exported = JSON.parse(run(bin, ['--project', project, '--json', 'export']).stdout);
const cleanReport = exported.reports.find(report => report.name === 'portfolio-summary');
const trapReport = exported.reports.find(report => report.name === 'portfolio-summary-trap');
assert.equal(cleanReport.decision, 'allow');
assert.equal(trapReport.decision, 'hold');
assert.equal(cleanReport.source.kind, 'github');
assert.equal(trapReport.source.kind, 'github');
assert.ok(cleanReport.source.revision && trapReport.source.revision);

const ptyOutput = join(root, 'public-cli-pty.json');
run('python3', [resolve('scripts/cli-pty-smoke.py')], {
  env: { ...cleanEnv, SKILLGATE_TEST_CLI: installedCli, SKILLGATE_PTY_OUTPUT: ptyOutput }, timeout: 60_000,
});
const pty = JSON.parse(await readFile(ptyOutput, 'utf8'));
assert.equal(pty.status, 'passed');
assert.equal(pty.checkCount, 13);
assert.equal(pty.cli, installedCli);
const result = {
  schemaVersion: 1, executedAt: new Date().toISOString(), status: 'passed',
  package: { name: manifest.name, version: manifest.version, url: values.url, checksumsUrl: values.checksums, sha256: checksum, bytes: archiveBytes.length, installedCliSha256: sha256(verifiedCliBytes) },
  authentication: 'none; empty npm user/global config and separate cache; no operator credentials passed',
  publicRequests, temporaryRoot: root, prefix, project, commands,
  demo: { repository: `https://github.com/${demoRepo}`, sourceType: 'synthetic-development-fixtures', clean: { scanId: cleanReport.id, fingerprint: cleanReport.fingerprint, source: cleanReport.source, installed: true }, trap: { scanId: trapReport.id, fingerprint: trapReport.fingerprint, source: trapReport.source, installed: false, decision: trapReport.decision } },
  originalInstallerInvoked: false, pty, paidProviderCalls: 0, realFunds: false,
  actualExecution: 'Anonymous public download and checksum verification, npm installation directly from public URL, shell activation, public GitHub skills scanned before activation, and 13 PTY flows on that installed public package.',
};
await writeFile('outputs/public-package-smoke.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, package: result.package, ptyChecks: pty.checkCount, demo: result.demo, output: resolve('outputs/public-package-smoke.json') }, null, 2));
