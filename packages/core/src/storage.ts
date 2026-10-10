import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';

export class SkillGateError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'SkillGateError'; }
}
export function sanitizeTerminal(value: string): string {
  return value.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '');
}
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const stateDir = (root: string): string => path.join(path.resolve(root), '.skillgate');
export function safeName(name: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw new SkillGateError('INVALID_NAME', 'Invalid skill name: use 1 to 64 lowercase letters, digits, or hyphens.');
  return name;
}
export function safeId(id: string): string {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) throw new SkillGateError('INVALID_ID', 'Invalid report ID.');
  return id;
}
export async function exists(file: string): Promise<boolean> {
  try { await fs.lstat(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
export async function ensureDirectory(directory: string): Promise<void> {
  const absolute = path.resolve(directory);
  // Every existing ancestor is checked, so a symlink cannot redirect private state or activation.
  let current = path.parse(absolute).root;
  for (const component of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try { await fs.mkdir(current, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const stat = await fs.lstat(current);
    const systemAlias = stat.isSymbolicLink() && ['/var', '/tmp', '/etc'].includes(current) && (await fs.realpath(current)).startsWith('/private/');
    if ((!stat.isDirectory() || stat.isSymbolicLink()) && !systemAlias) throw new SkillGateError('UNSAFE_DIRECTORY', `Directory refused: ${sanitizeTerminal(current)}`);
  }
}
export async function ensureState(root: string): Promise<void> {
  for (const name of ['', 'reports', 'quarantine', 'snapshots', 'installs', 'locks', 'transactions']) await ensureDirectory(path.join(stateDir(root), name));
  await fs.chmod(stateDir(root), 0o700);
}
export async function atomicJson(file: string, value: unknown): Promise<void> {
  await ensureDirectory(path.dirname(file));
  if (await exists(file)) {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.nlink !== 1) throw new SkillGateError('UNSAFE_STATE', 'State file is not a regular file or has multiple links.');
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
  try { await fs.rename(temporary, file); } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
  const directory = await fs.open(path.dirname(file), constants.O_RDONLY);
  try { await directory.sync(); } finally { await directory.close(); }
}
export async function readJson(file: string): Promise<unknown> {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 20 * 1024 * 1024) throw new SkillGateError('UNSAFE_STATE', 'Invalid state file.');
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return JSON.parse(await handle.readFile('utf8')) as unknown; } finally { await handle.close(); }
}
export async function withTargetLock<T>(root: string, name: string, work: () => Promise<T>, scope: 'target' | 'maintenance' = 'target'): Promise<T> {
  await ensureState(root);
  const lock = path.join(stateDir(root), 'locks', `${scope}-${safeName(name)}.lock`);
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const handle = await fs.open(lock, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); await handle.close();
      acquired = true; break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const owner = await readJson(lock) as { pid: number };
        if (!Number.isInteger(owner.pid) || owner.pid < 1) throw new SkillGateError('LOCKED', 'Invalid lock: manual review required.');
        try { process.kill(owner.pid, 0); } catch (probe) { if ((probe as NodeJS.ErrnoException).code === 'ESRCH') await fs.unlink(lock); }
      } catch (probe) { if (probe instanceof SkillGateError) throw probe; }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
  if (!acquired) throw new SkillGateError('LOCKED', 'Another installation is using this target. Try again.');
  try { return await work(); } finally { await fs.rm(lock, { force: true }); }
}
