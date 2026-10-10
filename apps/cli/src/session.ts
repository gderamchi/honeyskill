import { spawn } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { realpath } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { initProject, sanitizeTerminal, SkillGateError } from '../../../packages/core/src/index.js';
import { prepareTerminal, terminalStatus } from './terminal.js';

/** A temporary protected shell: parent shell configuration and startup files stay untouched. */
export async function startProtectedSession(
  root: string,
  cliPath: string,
  options: { json?: boolean; nodePath?: string } = {},
): Promise<number> {
  if (options.json || !process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY) {
    throw Object.assign(new SkillGateError('TTY_REQUIRED', 'skillgate on requires an interactive terminal, without --json.'), { exitCode: 2 });
  }
  const projectRoot = await realpath(resolve(root));
  if ((await terminalStatus(projectRoot)).active) {
    process.stdout.write('SkillGate is already active in this terminal. Type exit to leave the protected session.\n');
    return 0;
  }
  await initProject(projectRoot);
  await prepareTerminal(projectRoot, cliPath, options.nodePath);
  const env = {
    ...process.env,
    PATH: `${join(projectRoot, '.skillgate/bin')}${delimiter}${process.env.PATH ?? ''}`,
    SKILLGATE_PROJECT: projectRoot,
    SHELL: '/bin/bash',
    PS1: '[SkillGate] $ ',
    HISTFILE: '/dev/null',
    HISTSIZE: '0',
  };
  // --norc/--noprofile disable files; clear inherited Bash hooks/functions as well.
  for (const key of Object.keys(env)) if (['BASH_ENV', 'ENV', 'PROMPT_COMMAND', 'BASHOPTS', 'SHELLOPTS'].includes(key) || key.startsWith('BASH_FUNC_')) delete env[key as keyof typeof env];
  process.stderr.write(sanitizeTerminal(`SkillGate is active for ${projectRoot}. Install skills as usual. Type exit to return to your terminal.\n`));
  return new Promise((resolveExit, reject) => {
    let child: ReturnType<typeof spawn> | undefined;
    const interrupt = () => { child?.kill('SIGINT'); };
    const terminate = () => { child?.kill('SIGHUP'); };
    const cleanup = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
      process.removeListener('SIGHUP', terminate);
    };
    // Install before spawning so Ctrl-C cannot strand the child while the parent exits.
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    process.on('SIGHUP', terminate);
    child = spawn('/bin/bash', ['--noprofile', '--norc', '-i'], { cwd: projectRoot, env, stdio: 'inherit' });
    child.once('error', error => { cleanup(); reject(new SkillGateError('SHELL_UNAVAILABLE', `Cannot start Bash: ${sanitizeTerminal(error.message)}`)); });
    child.once('exit', (code, signal) => { cleanup(); resolveExit(code ?? (signal ? 128 + osConstants.signals[signal] : 1)); });
  });
}
