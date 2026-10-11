import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Coverage, ManifestEntry, Source } from '../../contracts/src/index.js';
import { ensureDirectory, exists, safeName, sha256, HoneySkillError } from './storage.js';
import { downloadGithubArchive, parseGithubArchive, remainingTime, resolveGithubRevision } from './github-archive.js';

export const LIMITS = { files: 256, bytes: 2 * 1024 * 1024, fileBytes: 256 * 1024, depth: 12, durationMs: 20_000 } as const;
export interface Inventory { manifest: ManifestEntry[]; texts: Map<string, string>; coverage: Coverage; fingerprint: string }
const textExtensions = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.sh', '.bash', '.zsh', '.ps1', '.csv', '.xml', '.html', '.css', '.sql', '.env', '.ini', '.cfg']);
export function safeRelative(input: string): string {
  if (!input || path.isAbsolute(input) || input.includes('\\') || input.normalize('NFC') !== input || /[\x00-\x1f\x7f:]/.test(input) || input.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) throw new HoneySkillError('UNSAFE_PATH', 'Absolute, ambiguous, or traversal path refused.');
  return input;
}
export const freshCoverage = (): Coverage => ({ status: 'complete_for_supported_checks', inventoried: 0, read: 0, supported: 0, bytes: 0, ignored: [], unresolved: [], limitsReached: [], errors: [] });
export function finalizeCoverage(coverage: Coverage): void {
  if (coverage.errors.length || coverage.ignored.length || coverage.unresolved.length || coverage.limitsReached.length) coverage.status = coverage.read ? 'partial' : 'failed';
}
export async function inventory(directory: string, copyTo?: string, deadline = performance.now() + LIMITS.durationMs): Promise<Inventory> {
  const manifest: ManifestEntry[] = [], texts = new Map<string, string>(), coverage = freshCoverage();
  const walk = async (relative: string, depth: number): Promise<void> => {
    if (depth > LIMITS.depth) { coverage.limitsReached.push(`Maximum depth: ${LIMITS.depth}`); return; }
    const dir = path.join(directory, relative);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (performance.now() > deadline) { coverage.limitsReached.push('Inventory time limit reached.'); return; }
      const file = safeRelative(relative ? `${relative}/${entry.name}` : entry.name);
      const full = path.join(directory, file), stat = await fs.lstat(full);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1)) throw new HoneySkillError('UNSAFE_ENTRY', `Link or special file refused: ${file}`);
      if (stat.isDirectory()) { await walk(file, depth + 1); continue; }
      coverage.inventoried++;
      if (coverage.inventoried > LIMITS.files) { coverage.limitsReached.push(`Maximum file count: ${LIMITS.files}`); return; }
      if (stat.size > LIMITS.fileBytes || coverage.bytes + stat.size > LIMITS.bytes) { coverage.ignored.push({ file, reason: 'Size limit exceeded.' }); coverage.limitsReached.push(`Size is limited to ${LIMITS.fileBytes} bytes per file and ${LIMITS.bytes} per package.`); continue; }
      const handle = await fs.open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
      let content: Buffer;
      try {
        const opened = await handle.stat();
        if (opened.ino !== stat.ino || opened.dev !== stat.dev || opened.nlink !== 1 || !opened.isFile() || opened.size > LIMITS.fileBytes) throw new HoneySkillError('SOURCE_CHANGED', 'The source changed during collection.');
        content = Buffer.alloc(opened.size + 1);
        const { bytesRead } = await handle.read(content, 0, content.length, 0);
        content = content.subarray(0, bytesRead);
        const after = await handle.stat();
        if (bytesRead !== opened.size || after.mtimeMs !== opened.mtimeMs || after.size !== opened.size) throw new HoneySkillError('SOURCE_CHANGED', 'The source changed during collection.');
      } finally { await handle.close(); }
      const executable = (stat.mode & 0o111) !== 0;
      manifest.push({ path: file, size: content.length, sha256: sha256(content), executable });
      coverage.bytes += content.length; coverage.read++;
      if (copyTo) {
        const destination = path.join(copyTo, file); await ensureDirectory(path.dirname(destination));
        await fs.writeFile(destination, content, { flag: 'wx', mode: executable ? 0o700 : 0o600 });
      }
      let decoded: string | undefined;
      try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(content); } catch { /* Binary remains inventoried and explicitly unsupported. */ }
      if (decoded !== undefined && !decoded.includes('\0') && (textExtensions.has(path.extname(file).toLowerCase()) || file === 'LICENSE' || file === 'Dockerfile')) { texts.set(file, decoded); coverage.supported++; }
      else coverage.ignored.push({ file, reason: 'Binary format or file extension is unsupported by static analysis.' });
    }
  };
  const rootStat = await fs.lstat(directory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new HoneySkillError('UNSAFE_SOURCE', 'The source must be a regular directory without a symlink.');
  await walk('', 0);
  manifest.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  finalizeCoverage(coverage);
  return { manifest, texts, coverage, fingerprint: sha256(JSON.stringify(manifest)) };
}
export function skillMetadata(text: string): { name: string; description: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new HoneySkillError('INVALID_SKILL', 'SKILL.md must contain YAML name and description metadata.');
  let value: unknown; try { value = parseYaml(match[1]!, { maxAliasCount: 20 }); } catch { throw new HoneySkillError('INVALID_SKILL', 'Invalid YAML metadata.'); }
  if (!value || typeof value !== 'object' || !('name' in value) || !('description' in value) || typeof value.name !== 'string' || typeof value.description !== 'string' || value.description.length > 1024) throw new HoneySkillError('INVALID_SKILL', 'Name and description metadata are required.');
  return { name: safeName(value.name), description: value.description };
}
async function chooseLocal(source: string, requested?: string): Promise<string> {
  const absolute = path.resolve(source);
  if (/\.(?:zip|tar|tgz|gz|7z|rar)$/i.test(source)) throw new HoneySkillError('ARCHIVE_UNSUPPORTED', 'Archives are unsupported. Use a verified extracted directory or a public GitHub repository.');
  if (!await exists(absolute)) throw new HoneySkillError('SOURCE_NOT_FOUND', 'Source directory not found.');
  const rootStat = await fs.lstat(absolute);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new HoneySkillError('UNSAFE_SOURCE', 'The source must be a regular directory.');
  if (await exists(path.join(absolute, 'SKILL.md'))) return absolute;
  const choices: string[] = [];
  const search = async (directory: string, depth: number): Promise<void> => {
    if (depth > 3 || choices.length > 50) return;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || !entry.isDirectory() || entry.isSymbolicLink()) continue;
      const nested = path.join(directory, entry.name);
      if (await exists(path.join(nested, 'SKILL.md'))) choices.push(nested); else await search(nested, depth + 1);
    }
  };
  await search(absolute, 0);
  if (requested) {
    safeName(requested);
    const matches = choices.filter(item => path.basename(item) === requested);
    if (matches.length === 1) return matches[0]!;
  }
  if (choices.length === 1 && !requested) return choices[0]!;
  throw new HoneySkillError(choices.length ? 'AMBIGUOUS_SKILL' : 'INVALID_SKILL', choices.length ? `Multiple skills found. Specify --skill: ${choices.map(item => path.basename(item)).join(', ')}` : 'No SKILL.md found in the source.');
}
async function acquireGithub(input: string, destination: string, requested?: string): Promise<{ source: Source; inventory: Inventory }> {
  // Parse the original path, before URL normalization could erase a traversal component.
  const match = /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)(?:\/tree\/([^/?#]+)(?:\/([^?#]*))?)?\/?$/i.exec(input);
  if (!match || input.length > 2048 || /[\x00-\x20\x7f]/.test(input)) throw new HoneySkillError('SOURCE_FORBIDDEN', 'Use a public https://github.com/owner/repo URL, optionally with /tree/revision/subdirectory.');
  let owner: string, repo: string, reference: string, folder: string;
  try { owner = decodeURIComponent(match[1]!); repo = decodeURIComponent(match[2]!).replace(/\.git$/, ''); reference = decodeURIComponent(match[3] ?? 'HEAD'); folder = decodeURIComponent(match[4] ?? '').replace(/\/$/, ''); }
  catch { throw new HoneySkillError('SOURCE_FORBIDDEN', 'Invalid encoding in the GitHub source URL.'); }
  if (![owner, repo].every(value => /^[a-zA-Z0-9_.-]{1,100}$/.test(value) && !['.', '..'].includes(value)) || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/.test(reference) || reference.includes('..') || reference.split('/').some(part => !part || part.endsWith('.') || part.endsWith('.lock'))) throw new HoneySkillError('SOURCE_FORBIDDEN', 'Invalid GitHub repository or revision. Use a branch, tag, or full commit SHA.');
  if (folder) safeRelative(folder);
  if (requested) safeName(requested);
  const deadline = performance.now() + LIMITS.durationMs;
  const revision = await resolveGithubRevision(owner, repo, reference, deadline);
  const archive = await downloadGithubArchive(owner, repo, revision, deadline);
  const entries = parseGithubArchive(archive, repo, revision, deadline);
  const skillPaths = entries.filter(file => file.path === 'SKILL.md' || file.path.endsWith('/SKILL.md')).map(file => path.posix.dirname(file.path)).filter(file => !folder || file === folder || file.startsWith(`${folder}/`));
  if (!skillPaths.includes(folder || '.')) {
    const matches = requested ? skillPaths.filter(file => path.posix.basename(file) === requested) : skillPaths;
    if (matches.length !== 1) throw new HoneySkillError('AMBIGUOUS_SKILL', 'Select a GitHub subdirectory containing SKILL.md or use --skill.');
    folder = matches[0] === '.' ? '' : matches[0]!;
  }
  const files = entries.filter(file => !folder || file.path.startsWith(`${folder}/`));
  let bytes = 0;
  if (files.length > LIMITS.files) throw new HoneySkillError('DOWNLOAD_LIMIT', 'Too many files in the GitHub package.');
  // Validate the whole selected snapshot before writing any acquired bytes.
  const selected = files.map(file => {
    const relative = safeRelative(folder ? file.path.slice(folder.length + 1) : file.path);
    if (relative.split('/').length > LIMITS.depth || file.content.length > LIMITS.fileBytes || (bytes += file.content.length) > LIMITS.bytes) throw new HoneySkillError('DOWNLOAD_LIMIT', 'GitHub package limit exceeded.');
    return { ...file, relative };
  });
  for (const file of selected) {
    remainingTime(deadline);
    const target = path.join(destination, file.relative); await ensureDirectory(path.dirname(target));
    await fs.writeFile(target, file.content, { flag: 'wx', mode: file.executable ? 0o700 : 0o600 });
  }
  const collected = await inventory(destination, undefined, deadline);
  remainingTime(deadline);
  return { source: { kind: 'github', locator: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(reference)}${folder ? `/${folder.split('/').map(encodeURIComponent).join('/')}` : ''}`, revision, ...(folder ? { subdirectory: folder } : {}) }, inventory: collected };
}
export async function acquire(source: string, destination: string, requested?: string): Promise<{ source: Source; inventory: Inventory }> {
  await ensureDirectory(destination);
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) return acquireGithub(source, destination, requested);
  const local = await chooseLocal(source, requested);
  return { source: { kind: 'local', locator: local }, inventory: await inventory(local, destination) };
}
