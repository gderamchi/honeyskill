import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(sourceRoot, 'package.json'), 'utf8'));
const output = path.join(sourceRoot, 'outputs');
const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'skillgate-short-install-')));
const prefix = path.join(temporary, 'isolated prefix');
const isolatedHome = path.join(temporary, 'isolated home');
const checkout = path.join(temporary, 'public source checkout');
const isolatedTmp = path.join(temporary, 'tmp');
const userConfig = path.join(temporary, 'empty-user.npmrc');
const globalConfig = path.join(temporary, 'empty-global.npmrc');
const repositoryUrl = 'https://github.com/gderamchi/skillgate';
const target = 'gderamchi/skillgate';
const env = {
  PATH: `${path.join(prefix, 'bin')}${path.delimiter}${process.env.PATH}`,
  HOME: isolatedHome, CODEX_HOME: path.join(isolatedHome, '.codex'), ZDOTDIR: isolatedHome,
  TMPDIR: isolatedTmp, XDG_CONFIG_HOME: path.join(isolatedHome, '.config'), XDG_CACHE_HOME: path.join(isolatedHome, '.cache'),
  npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig, npm_config_cache: path.join(temporary, 'npm cache'),
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', NO_COLOR: '1', CI: 'true',
};
const evidence = {
  schemaVersion: 1, startedAt: new Date().toISOString(), status: 'running', repositoryUrl,
  publicInstallCommand: `npm i -g ${target}`, publicActivationCommand: 'skillgate on', expectedVersion: manifest.version,
  anonymous: true, credentialsInherited: false, npmLifecyclePolicy: 'default; --ignore-scripts is not used for the public installation',
  temporary, prefix, checkout, commands: [], realModelExecution: false, paidProviderCalls: 0, realFunds: false,
};
const hash = data => createHash('sha256').update(data).digest('hex');
async function run(binary, args, label, cwd = temporary, extraEnv = {}) {
  const started = performance.now(); let stdout = '', stderr = '';
  const child = spawn(binary, args, { cwd, env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  const timeout = setTimeout(() => child.kill('SIGTERM'), 180000);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); }).finally(() => clearTimeout(timeout));
  const logFile = path.join(output, `short-install-${String(evidence.commands.length + 1).padStart(2, '0')}.log`);
  await writeFile(logFile, `$ ${binary} ${args.join(' ')}\n${stdout}${stderr}`);
  evidence.commands.push({ label, binary, args, cwd, exitCode: result.code, signal: result.signal, durationMs: Math.round(performance.now() - started), logFile });
  console.log(`${result.code === 0 ? 'PASS' : 'FAIL'} ${label}`);
  assert.equal(result.code, 0, `${label}: ${stderr.slice(-5000)}\n${stdout.slice(-2000)}`);
  return stdout;
}
try {
  await Promise.all([mkdir(output, { recursive: true }), mkdir(isolatedHome, { recursive: true }), mkdir(isolatedTmp), mkdir(prefix), writeFile(userConfig, ''), writeFile(globalConfig, '')]);
  evidence.nodeVersion = process.version;
  evidence.npmVersion = (await run('npm', ['--version'], 'npm version')).trim();
  const remote = await run('git', ['-c', 'credential.helper=', '-c', 'core.askPass=', '-c', 'http.extraHeader=', 'ls-remote', `${repositoryUrl}.git`, 'HEAD'], 'anonymous public revision');
  evidence.commit = remote.trim().split(/\s+/)[0]; assert.match(evidence.commit, /^[a-f0-9]{40}$/);
  await run('npm', ['i', '-g', target, '--prefix', prefix], 'public shorthand installation with default lifecycle policy');
  const packageRoot = path.join(prefix, 'lib/node_modules', manifest.name);
  const installed = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(installed.version, manifest.version);
  assert.equal(installed.dependencies, undefined, 'Installed package must have no runtime dependencies');
  assert.equal(installed.workspaces, undefined, 'Git installs must not prepare npm workspaces');
  for (const name of ['build', 'prepare', 'prepack', 'preinstall', 'install', 'postinstall']) assert.equal(installed.scripts?.[name], undefined, `${name} would trigger npm git preparation`);
  const rootFiles = (await readdir(packageRoot)).sort();
  assert.ok(rootFiles.every(name => ['README.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'package.json', 'dist'].includes(name)), `Unexpected packaged files: ${rootFiles.join(', ')}`);
  evidence.installedRootFiles = rootFiles;
  const cli = path.join(packageRoot, 'dist/cli.js');
  const cliData = await readFile(cli);
  evidence.installedCli = { sha256: hash(cliData), bytes: cliData.length, packageName: installed.name, version: installed.version, runtimeDependencies: 0 };
  const map = JSON.parse(await readFile(`${cli}.map`, 'utf8'));
  assert.ok(map.sources.every(source => !/(?:apps\/web|\/react(?:-dom)?\/|vite\/|apps\/cli\/src\/server)/.test(source)), 'Installed CLI must exclude web/server code');
  const skillgate = path.join(prefix, 'bin/skillgate');
  assert.equal((await run(skillgate, ['--version'], 'installed CLI version')).trim(), manifest.version);
  const help = await run(skillgate, ['--help'], 'installed CLI exposes activation');
  assert.match(help, /^\s+on(?:\s|$)/m);
  const sessionOutput = path.join(output, 'short-install-session-pty.json');
  await run('python3', [path.join(sourceRoot, 'scripts/session-pty-smoke.py')], 'installed skillgate on in a real interactive terminal', temporary, { SKILLGATE_TEST_CLI: cli, SKILLGATE_SESSION_OUTPUT: sessionOutput });
  evidence.session = JSON.parse(await readFile(sessionOutput, 'utf8'));
  assert.equal(evidence.session.status, 'passed'); assert.equal(evidence.session.upstreamInstallerExecuted, false);
  await run('git', ['-c', 'credential.helper=', '-c', 'core.askPass=', '-c', 'http.extraHeader=', 'clone', '--no-checkout', `${repositoryUrl}.git`, checkout], 'anonymous source clone');
  await run('git', ['checkout', '--detach', evidence.commit], 'checkout installed public revision', checkout);
  assert.equal(hash(await readFile(path.join(checkout, 'dist/cli.js'))), evidence.installedCli.sha256, 'Installed CLI must equal the public committed bundle');
  evidence.pnpmVersion = (await run('pnpm', ['--version'], 'pnpm version', checkout)).trim();
  await run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], 'source dependencies without lifecycle scripts', checkout);
  await run('pnpm', ['typecheck'], 'public source typecheck', checkout);
  const tests = await run('pnpm', ['test'], 'public source tests', checkout);
  const count = key => { const match = tests.match(new RegExp(`(?:^|\\n)(?:ℹ|#)\\s+${key}\\s+(\\d+)`, 'm')); return match ? Number(match[1]) : null; };
  evidence.testCounts = { tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped') };
  assert.ok(evidence.testCounts.tests > 0); assert.equal(evidence.testCounts.failed, 0);
  await run('pnpm', ['build:cli'], 'public source rebuild', checkout);
  evidence.rebuiltCliSha256 = hash(await readFile(path.join(checkout, 'dist/cli.js')));
  assert.equal(evidence.rebuiltCliSha256, evidence.installedCli.sha256, 'Fresh source rebuild must match installed bytes');
  assert.equal((await run('npx', ['--yes', target, '--version'], 'public shorthand single-use runner')).trim(), manifest.version);
  evidence.singleUseCommand = `npx --yes ${target} --version`;
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed'; evidence.error = error.stack ?? String(error); process.exitCode = 1; console.error(error.message);
} finally {
  await rm(temporary, { recursive: true, force: true });
  evidence.temporaryRemoved = true; evidence.completedAt = new Date().toISOString();
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'short-install-smoke.json'), JSON.stringify(evidence, null, 2) + '\n');
  const summary = {
    schemaVersion: 1, verifiedAt: evidence.completedAt, status: evidence.status, repositoryUrl,
    commit: evidence.commit ?? null, version: manifest.version, installCommand: evidence.publicInstallCommand, activationCommand: evidence.publicActivationCommand,
    anonymous: true, installScriptsPolicy: 'default; package has no lifecycle or Git preparation hooks',
    nodeVersion: evidence.nodeVersion ?? null, npmVersion: evidence.npmVersion ?? null, pnpmVersion: evidence.pnpmVersion ?? null,
    commands: evidence.commands.map(command => ({ name: command.label, status: command.exitCode === 0 ? 'passed' : 'failed', exitCode: command.exitCode })),
    installedCli: evidence.installedCli ?? null, rebuiltCliSha256: evidence.rebuiltCliSha256 ?? null, testCounts: evidence.testCounts ?? null,
    interactiveSession: evidence.session ? { status: evidence.session.status, checkCount: evidence.session.checkCount, checks: evidence.session.checks, upstreamInstallerExecuted: evidence.session.upstreamInstallerExecuted, inheritedStartupExecuted: evidence.session.inheritedStartupExecuted, parentHistoryWritten: evidence.session.parentHistoryWritten } : null,
    singleUseCommand: evidence.singleUseCommand ?? null, realModelExecution: false, paidProviderCalls: 0, realFunds: false,
  };
  await writeFile(path.join(output, 'short-install-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ status: summary.status, version: manifest.version, commit: summary.commit, testCounts: summary.testCounts, sessionChecks: summary.interactiveSession?.checkCount, cliSha256: summary.installedCli?.sha256 }, null, 2));
}
