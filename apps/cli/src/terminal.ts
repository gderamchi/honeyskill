import { constants as fsConstants } from 'node:fs';
import { access, chmod, lstat, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { delimiter, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { atomicJson, ensureDirectory, ensureState, readJson, sanitizeTerminal, SkillGateError, stateDir } from '../../../packages/core/src/storage.js';

export const terminalCommands = ['npx', 'pnpm', 'skills'] as const;
export type TerminalCommand = typeof terminalCommands[number];
export type InstallerInvocation = { kind: 'install'; source: string; skill?: string }
  | { kind: 'delegate' } | { kind: 'reject'; reason: string };
const packageName = /^skills(?:@[a-zA-Z0-9._~^+*-]+)?$/;
const mentionsSkills = (args: string[]) => args.some(arg => /(?:^|[=\s])skills(?:@[a-zA-Z0-9._~^+*-]+)?(?=$|\s)/.test(arg));
const rejected = (reason: string): InstallerInvocation => ({ kind: 'reject', reason });

/** Parse only the deliberately supported installer forms; never execute the upstream installer. */
export function parseInstallerArgv(command: TerminalCommand, args: string[]): InstallerInvocation {
  let tail = args;
  if (command === 'npx') {
    let offset = 0;
    while (args[offset] === '-y' || args[offset] === '--yes') offset++;
    if (!packageName.test(args[offset] ?? '')) return mentionsSkills(args)
      ? rejected('Unsupported npx invocation of skills. Use npx skills add SOURCE [--skill NAME].') : { kind: 'delegate' };
    tail = args.slice(offset + 1);
  } else if (command === 'pnpm') {
    if (args[0] !== 'dlx' || !packageName.test(args[1] ?? '')) return mentionsSkills(args)
      ? rejected('Unsupported pnpm invocation of skills. Use pnpm dlx skills add SOURCE [--skill NAME].') : { kind: 'delegate' };
    tail = args.slice(2);
  }
  const operation = tail[0];
  // Upstream find/search can install, and check aliases update; none may bypass the gate.
  if (!operation || ['--help', '-h', '--version', '-v', 'help', 'list', 'ls', 'remove', 'rm', 'init'].includes(operation)) return { kind: 'delegate' };
  if (operation !== 'add' && operation !== 'install') return rejected('Unsupported skills command. For a checked update: honeyskill update NAME. To install: skills add SOURCE.');
  let source: string | undefined, skill: string | undefined, agent: string | undefined;
  for (let index = 1; index < tail.length; index++) {
    const value = tail[index];
    if (value === '--yes' || value === '-y') continue; // Upstream acknowledgement never accepts a HoneySkill risk.
    if (value === '--skill') {
      if (skill || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(tail[index + 1] ?? '')) return rejected('Select exactly one skill with --skill NAME.');
      skill = tail[++index];
    } else if (value === '--agent' || value === '-a') {
      if (agent || tail[index + 1] !== 'codex') return rejected('Only the project Codex target is supported: --agent codex.');
      agent = tail[++index];
    } else if (value.startsWith('-')) return rejected(`Unsupported installation option: ${sanitizeTerminal(value)}. Global, multiple and --all installations are denied.`);
    else if (source) return rejected('Only one source and one skill are allowed per installation.');
    else source = value;
  }
  if (!source) return rejected('Missing source. Use skills add SOURCE [--skill NAME].');
  if (/[\u0000-\u001f\u007f]/.test(source)) return rejected('Source contains control characters and was rejected.');
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source) && !source.startsWith('./') && !source.startsWith('../')) source = `https://github.com/${source}`;
  else if (source.startsWith('https://')) {
    try {
      const url = new URL(source);
      if (url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/[^/]+\/[^/]+(?:\/tree\/.+)?\/?$/.test(url.pathname)) return rejected('Unsupported remote source: use a public https://github.com/OWNER/REPO repository.');
    } catch { return rejected('Invalid GitHub URL.'); }
  } else if (!(isAbsolute(source) || source === '.' || source === '..' || source.startsWith('./') || source.startsWith('../'))) return rejected('Unsupported source: use OWNER/REPO, a GitHub HTTPS URL or an explicit local path.');
  return { kind: 'install', source, ...(skill ? { skill } : {}) };
}

const absolutePath = z.string().refine(isAbsolute, 'An absolute path is required');
const TerminalConfigSchema = z.object({
  schemaVersion: z.literal(1), projectRoot: absolutePath, cliPath: absolutePath, nodePath: absolutePath,
  originals: z.object({ npx: absolutePath.nullable(), pnpm: absolutePath.nullable(), skills: absolutePath.nullable() }),
});
type TerminalConfig = z.infer<typeof TerminalConfigSchema>;
const configPath = (root: string) => join(stateDir(root), 'terminal.json');
const binPath = (root: string) => join(stateDir(root), 'bin');
const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

async function readTerminalConfig(root: string): Promise<TerminalConfig> {
  const config = TerminalConfigSchema.parse(await readJson(configPath(root)));
  if (await realpath(config.projectRoot) !== await realpath(resolve(root))) throw new SkillGateError('TERMINAL_CONFIG', 'Inconsistent terminal configuration; reactivate HoneySkill in this project.');
  return config;
}

async function executable(path: string): Promise<boolean> {
  try { await access(path, fsConstants.X_OK); return (await lstat(await realpath(path))).isFile(); }
  catch { return false; }
}

async function originalExecutable(command: TerminalCommand): Promise<string | null> {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = resolve(directory || '.', command);
    if (!await executable(candidate)) continue;
    const resolved = await realpath(candidate);
    // Skip this project's shims and those inherited from another protected terminal.
    if (/[\\/]\.skillgate[\\/]bin[\\/]/.test(candidate) || /[\\/]\.skillgate[\\/]bin[\\/]/.test(resolved)) continue;
    return candidate;
  }
  return null;
}

export async function prepareTerminal(root: string, cliPath: string, nodePath = process.execPath): Promise<TerminalConfig> {
  const projectRoot = resolve(root);
  if (!isAbsolute(cliPath) || !isAbsolute(nodePath) || !await executable(nodePath)) throw new SkillGateError('TERMINAL_RUNTIME', 'Absolute paths to a compiled CLI and a Node executable are required.');
  await access(cliPath, fsConstants.R_OK);
  await ensureState(projectRoot);
  await ensureDirectory(binPath(projectRoot));
  await atomicJson(join(binPath(projectRoot), 'package.json'), { private: true, type: 'commonjs' });
  const originals = Object.fromEntries(await Promise.all(terminalCommands.map(async command => [command, await originalExecutable(command)]))) as TerminalConfig['originals'];
  const config: TerminalConfig = { schemaVersion: 1, projectRoot, cliPath, nodePath, originals };
  // Configuration is ready before exposing any wrapper; failed preparation leaves no unguarded installer.
  await atomicJson(configPath(projectRoot), config);
  for (const command of terminalCommands) {
    const file = join(binPath(projectRoot), command);
    const content = `#!/usr/bin/env node\n// Generated HoneySkill terminal shim.\nconst { spawnSync } = require('node:child_process');\nconst result = spawnSync(${JSON.stringify(nodePath)}, ${JSON.stringify([cliPath, '--project', projectRoot, 'terminal-dispatch', '--command', command, '--'])}.concat(process.argv.slice(2)), { stdio: 'inherit' });\nif (result.error) { process.stderr.write('HoneySkill unavailable: installation was not started.\\n'); process.exit(126); }\nif (result.signal) process.kill(process.pid, result.signal);\nelse process.exit(result.status ?? 1);\n`;
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, { mode: 0o700, flag: 'wx' });
    try { await rename(temporary, file); await chmod(file, 0o700); }
    finally { await rm(temporary, { force: true }); }
  }
  return config;
}

/** Emits shell code only; callers must eval it in their own terminal. */
export async function envScript(root: string): Promise<string> {
  const config = await readTerminalConfig(root);
  const bin = binPath(config.projectRoot);
  return `export SKILLGATE_PROJECT=${shellQuote(config.projectRoot)}\nexport PATH=${shellQuote(bin)}:"$PATH"\nhash -r 2>/dev/null || true\n`;
}

export async function terminalStatus(root: string) {
  let config: TerminalConfig;
  try { config = await readTerminalConfig(root); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { configured: false, active: false }; throw error; }
  const canonical = async (path: string | undefined) => path ? realpath(path).catch(() => undefined) : undefined;
  const expectedProject = await realpath(config.projectRoot);
  const expectedBin = await realpath(binPath(config.projectRoot));
  const active = await canonical(process.env.SKILLGATE_PROJECT) === expectedProject
    && await canonical((process.env.PATH ?? '').split(delimiter)[0]) === expectedBin;
  return { configured: true, active, bin: binPath(config.projectRoot), projectRoot: config.projectRoot };
}

function run(executable: string, args: string[]): Promise<number> {
  return new Promise(resolveExit => {
    const child = spawn(executable, args, { stdio: 'inherit' });
    child.once('error', error => { process.stderr.write(`${sanitizeTerminal(error.message)}\n`); resolveExit(127); });
    child.once('exit', (code, signal) => resolveExit(code ?? (signal ? 128 + osConstants.signals[signal] : 1)));
  });
}

export async function dispatchTerminal(root: string, command: TerminalCommand, args: string[]): Promise<number> {
  if (!terminalCommands.includes(command)) throw new SkillGateError('TERMINAL_COMMAND', 'Unsupported terminal command.');
  const invocation = parseInstallerArgv(command, args);
  if (invocation.kind === 'reject') { process.stderr.write(`HoneySkill: ${invocation.reason}\nNo upstream installer was started.\n`); return 2; }
  const config = await readTerminalConfig(root);
  if (invocation.kind === 'delegate') {
    const original = config.originals[command];
    if (!original) { process.stderr.write(`${command} was not found before HoneySkill activation.\n`); return 127; }
    return run(original, args);
  }
  if (await realpath(process.cwd()) !== await realpath(config.projectRoot)) {
    process.stderr.write('HoneySkill: this terminal protects another project. Leave this session (exit), then run honeyskill on in the current project before installing.\n');
    return 2;
  }
  process.stderr.write('HoneySkill: analyzing the skill before activation.\n');
  return run(config.nodePath, [config.cliPath, '--project', config.projectRoot, 'install', invocation.source, ...(invocation.skill ? ['--skill', invocation.skill] : [])]);
}
