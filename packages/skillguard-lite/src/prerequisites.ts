import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AnvilExecutable { executable: string; version: string }
export interface PrerequisiteOptions { requireApiKey?: boolean; environment?: NodeJS.ProcessEnv; anvilBinary?: string }

/** Only probes the user's configured/local Anvil binary; never accepts a path from acquired skill content. */
export async function resolveAnvilExecutable(options: { environment?: NodeJS.ProcessEnv; anvilBinary?: string } = {}): Promise<AnvilExecutable> {
  const environment = options.environment ?? process.env;
  const explicit = options.anvilBinary ?? environment.ANVIL_BIN;
  if (explicit && !path.isAbsolute(explicit)) throw new Error('ANVIL_BIN must be an absolute executable path.');
  // A checked-out source runner may use its development tool; distributed bundles must never search relative to an inspected project.
  const development = fileURLToPath(import.meta.url).endsWith(path.join('packages', 'skillguard-lite', 'src', 'prerequisites.ts'))
    ? [fileURLToPath(new URL('../../../work/skillguard-lite/bin/anvil', import.meta.url))] : [];
  const candidates = explicit ? [explicit] : [
    ...development,
    path.join(homedir(), '.foundry', 'bin', 'anvil'),
    ...(environment.PATH ?? '').split(path.delimiter).filter(directory => path.isAbsolute(directory)).map(directory => path.join(directory, 'anvil')),
  ];
  let executable: string | undefined;
  for (const candidate of [...new Set(candidates)]) {
    try {
      if (!(await stat(candidate)).isFile()) continue;
      await access(candidate, constants.X_OK);
      executable = await realpath(candidate); break;
    } catch { /* Try the next known local installation. */ }
  }
  if (!executable) throw new Error(explicit ? 'Configured ANVIL_BIN is not an executable file. Install Foundry or correct ANVIL_BIN.' : 'Anvil is not installed. Install Foundry or set ANVIL_BIN to its absolute executable path.');
  const version = await new Promise<string>((resolve, reject) => {
    const child = spawn(executable!, ['--version'], { cwd: tmpdir(), detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      PATH: environment.PATH ?? '/usr/bin:/bin', FOUNDRY_DISABLE_NIGHTLY_WARNING: '1',
    } });
    let output = '', settled = false;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) {
        if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
        reject(new Error(error));
      } else {
        const match = /^anvil Version: ([^\r\n]+)/m.exec(output);
        if (!match) reject(new Error('Configured executable did not identify itself as Anvil.'));
        else resolve(match[1]!.trim());
      }
    };
    const timer = setTimeout(() => finish('Anvil version check timed out after 5 seconds.'), 5_000);
    const collect = (data: Buffer) => { output += data.toString('utf8'); if (Buffer.byteLength(output) > 8_192) finish('Anvil version output exceeded its limit.'); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', () => finish('Anvil version check failed to start.'));
    child.once('close', code => finish(code === 0 ? undefined : 'Anvil version check failed.'));
  });
  return { executable, version };
}

export async function checkPrerequisites(options: PrerequisiteOptions = {}) {
  const environment = options.environment ?? process.env;
  const apiKeyPresent = Boolean(environment.OPENAI_API_KEY?.trim());
  const errors: string[] = [];
  if (options.requireApiKey !== false && !apiKeyPresent) errors.push('OPENAI_API_KEY is missing. Set an authorized API key in your environment; no model request was made.');
  let anvil: ({ available: true } & AnvilExecutable) | { available: false; error: string };
  try { anvil = { available: true, ...await resolveAnvilExecutable(options) }; }
  catch (error) { const message = (error as Error).message; anvil = { available: false, error: message }; errors.push(message); }
  return { ready: errors.length === 0, apiKeyPresent, anvil, errors };
}
