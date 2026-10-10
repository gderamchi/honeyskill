import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Coverage, ManifestEntry, Source } from '../../contracts/src/index.js';
import { ensureDirectory, exists, safeName, sha256, SkillGateError } from './storage.js';

export const LIMITS = { files: 256, bytes: 2 * 1024 * 1024, fileBytes: 256 * 1024, depth: 12, durationMs: 20_000 } as const;
export interface Inventory { manifest: ManifestEntry[]; texts: Map<string, string>; coverage: Coverage; fingerprint: string }
const textExtensions = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.sh', '.bash', '.zsh', '.ps1', '.csv', '.xml', '.html', '.css', '.sql', '.env', '.ini', '.cfg']);
export function safeRelative(input: string): string {
  if (!input || path.isAbsolute(input) || input.includes('\\') || input.normalize('NFC') !== input || /[\x00-\x1f\x7f:]/.test(input) || input.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) throw new SkillGateError('UNSAFE_PATH', 'Absolute, ambiguous, or traversal path refused.');
  return input;
}
export const freshCoverage = (): Coverage => ({ status: 'complete_for_supported_checks', inventoried: 0, read: 0, supported: 0, bytes: 0, ignored: [], unresolved: [], limitsReached: [], errors: [] });
export function finalizeCoverage(coverage: Coverage): void {
  if (coverage.errors.length || coverage.ignored.length || coverage.unresolved.length || coverage.limitsReached.length) coverage.status = coverage.read ? 'partial' : 'failed';
}
export async function inventory(directory: string, copyTo?: string): Promise<Inventory> {
  const manifest: ManifestEntry[] = [], texts = new Map<string, string>(), coverage = freshCoverage();
  const started = performance.now();
  const walk = async (relative: string, depth: number): Promise<void> => {
    if (depth > LIMITS.depth) { coverage.limitsReached.push(`Maximum depth: ${LIMITS.depth}`); return; }
    const dir = path.join(directory, relative);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (performance.now() - started > LIMITS.durationMs) { coverage.limitsReached.push('Inventory time limit reached.'); return; }
      const file = safeRelative(relative ? `${relative}/${entry.name}` : entry.name);
      const full = path.join(directory, file), stat = await fs.lstat(full);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1)) throw new SkillGateError('UNSAFE_ENTRY', `Link or special file refused: ${file}`);
      if (stat.isDirectory()) { await walk(file, depth + 1); continue; }
      coverage.inventoried++;
      if (coverage.inventoried > LIMITS.files) { coverage.limitsReached.push(`Maximum file count: ${LIMITS.files}`); return; }
      if (stat.size > LIMITS.fileBytes || coverage.bytes + stat.size > LIMITS.bytes) { coverage.ignored.push({ file, reason: 'Size limit exceeded.' }); coverage.limitsReached.push(`Size is limited to ${LIMITS.fileBytes} bytes per file and ${LIMITS.bytes} per package.`); continue; }
      const handle = await fs.open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
      let content: Buffer;
      try {
        const opened = await handle.stat();
        if (opened.ino !== stat.ino || opened.dev !== stat.dev || opened.nlink !== 1 || !opened.isFile() || opened.size > LIMITS.fileBytes) throw new SkillGateError('SOURCE_CHANGED', 'The source changed during collection.');
        content = Buffer.alloc(opened.size + 1);
        const { bytesRead } = await handle.read(content, 0, content.length, 0);
        content = content.subarray(0, bytesRead);
        const after = await handle.stat();
        if (bytesRead !== opened.size || after.mtimeMs !== opened.mtimeMs || after.size !== opened.size) throw new SkillGateError('SOURCE_CHANGED', 'The source changed during collection.');
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
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new SkillGateError('UNSAFE_SOURCE', 'The source must be a regular directory without a symlink.');
  await walk('', 0);
  manifest.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  finalizeCoverage(coverage);
  return { manifest, texts, coverage, fingerprint: sha256(JSON.stringify(manifest)) };
}
export function skillMetadata(text: string): { name: string; description: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new SkillGateError('INVALID_SKILL', 'SKILL.md must contain YAML name and description metadata.');
  let value: unknown; try { value = parseYaml(match[1]!, { maxAliasCount: 20 }); } catch { throw new SkillGateError('INVALID_SKILL', 'Invalid YAML metadata.'); }
  if (!value || typeof value !== 'object' || !('name' in value) || !('description' in value) || typeof value.name !== 'string' || typeof value.description !== 'string' || value.description.length > 1024) throw new SkillGateError('INVALID_SKILL', 'Name and description metadata are required.');
  return { name: safeName(value.name), description: value.description };
}
async function chooseLocal(source: string, requested?: string): Promise<string> {
  const absolute = path.resolve(source);
  if (/\.(?:zip|tar|tgz|gz|7z|rar)$/i.test(source)) throw new SkillGateError('ARCHIVE_UNSUPPORTED', 'Archives are unsupported. Use a verified extracted directory or a public GitHub repository.');
  if (!await exists(absolute)) throw new SkillGateError('SOURCE_NOT_FOUND', 'Source directory not found.');
  const rootStat = await fs.lstat(absolute);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new SkillGateError('UNSAFE_SOURCE', 'The source must be a regular directory.');
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
  throw new SkillGateError(choices.length ? 'AMBIGUOUS_SKILL' : 'INVALID_SKILL', choices.length ? `Multiple skills found. Specify --skill: ${choices.map(item => path.basename(item)).join(', ')}` : 'No SKILL.md found in the source.');
}
async function githubJson(endpoint: string, started: number): Promise<unknown> {
  const remaining = LIMITS.durationMs - (performance.now() - started);
  if (remaining <= 0) throw new SkillGateError('DOWNLOAD_TIMEOUT', 'GitHub collection timed out.');
  const response = await fetch(`https://api.github.com${endpoint}`, { redirect: 'error', signal: AbortSignal.timeout(Math.min(remaining, 8000)), headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'skillgate-finance-local' } });
  if (!response.ok) throw new SkillGateError('GITHUB_ERROR', `GitHub HTTP ${response.status}. Check the public repository, revision, and API rate limit.`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new SkillGateError('GITHUB_TYPE', 'Unexpected GitHub response.');
  const reader = response.body?.getReader();
  if (!reader) throw new SkillGateError('GITHUB_ERROR', 'Empty GitHub response.');
  let length = 0; const chunks: Uint8Array[] = [];
  while (true) { const result = await reader.read(); if (result.done) break; length += result.value.length; if (length > 4 * 1024 * 1024) { await reader.cancel(); throw new SkillGateError('DOWNLOAD_LIMIT', 'GitHub response exceeds the size limit.'); } chunks.push(result.value); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
async function acquireGithub(input: string, destination: string, requested?: string): Promise<{ source: Source; inventory: Inventory }> {
  let url: URL; try { url = new URL(input); } catch { throw new SkillGateError('SOURCE_FORBIDDEN', 'Invalid source URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new SkillGateError('SOURCE_FORBIDDEN', 'Only public https://github.com/owner/repo repositories are supported.');
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const owner = segments[0], repo = segments[1]?.replace(/\.git$/, '');
  if (!owner || !repo || ['.', '..'].includes(owner) || ['.', '..'].includes(repo) || !/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo) || (segments.length > 2 && segments[2] !== 'tree')) throw new SkillGateError('SOURCE_FORBIDDEN', 'Use /owner/repo or /owner/repo/tree/revision/subdirectory.');
  const reference = segments[3] || 'HEAD';
  let folder = segments.slice(4).join('/'); if (folder) safeRelative(folder);
  const started = performance.now(), api = `/repos/${owner}/${repo}`;
  const commit = await githubJson(`${api}/commits/${encodeURIComponent(reference)}`, started) as { sha?: string };
  if (!commit.sha || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new SkillGateError('GITHUB_REVISION', 'GitHub revision could not be resolved.');
  const tree = await githubJson(`${api}/git/trees/${commit.sha}?recursive=1`, started) as { truncated?: boolean; tree?: { path: string; type: string; mode: string; sha: string; size?: number }[] };
  if (tree.truncated || !Array.isArray(tree.tree)) throw new SkillGateError('DOWNLOAD_LIMIT', 'GitHub tree is incomplete or too large.');
  const skillPaths = tree.tree.filter(item => item.path === 'SKILL.md' || item.path.endsWith('/SKILL.md')).map(item => path.posix.dirname(item.path)).filter(item => !folder || item === folder || item.startsWith(`${folder}/`));
  if (!skillPaths.includes(folder || '.')) {
    const matches = requested ? skillPaths.filter(item => path.posix.basename(item) === requested) : skillPaths;
    if (matches.length !== 1) throw new SkillGateError('AMBIGUOUS_SKILL', 'Select a GitHub subdirectory containing SKILL.md or use --skill.');
    folder = matches[0] === '.' ? '' : matches[0]!;
  }
  const files = tree.tree.filter(item => item.type !== 'tree' && (!folder || item.path.startsWith(`${folder}/`)));
  let bytes = 0;
  if (files.length > LIMITS.files) throw new SkillGateError('DOWNLOAD_LIMIT', 'Too many files in the GitHub package.');
  for (const file of files) {
    const relative = safeRelative(folder ? file.path.slice(folder.length + 1) : file.path);
    if (file.type !== 'blob' || !['100644', '100755'].includes(file.mode)) throw new SkillGateError('UNSAFE_ENTRY', 'GitHub links and submodules are refused.');
    if (relative.split('/').length > LIMITS.depth || !Number.isInteger(file.size) || file.size! > LIMITS.fileBytes || (bytes += file.size!) > LIMITS.bytes) throw new SkillGateError('DOWNLOAD_LIMIT', 'GitHub package limit exceeded.');
    if (!/^[a-f0-9]{40}$/.test(file.sha)) throw new SkillGateError('GITHUB_ERROR', 'Invalid blob hash.');
    const blob = await githubJson(`${api}/git/blobs/${file.sha}`, started) as { encoding?: string; content?: string };
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw new SkillGateError('GITHUB_ERROR', 'Blob content unavailable.');
    const content = Buffer.from(blob.content, 'base64');
    if (content.length !== file.size) throw new SkillGateError('GITHUB_ERROR', 'Blob size mismatch.');
    const target = path.join(destination, relative); await ensureDirectory(path.dirname(target));
    await fs.writeFile(target, content, { flag: 'wx', mode: file.mode === '100755' ? 0o700 : 0o600 });
  }
  return { source: { kind: 'github', locator: `https://github.com/${owner}/${repo}/tree/${reference}${folder ? `/${folder}` : ''}`, revision: commit.sha, ...(folder ? { subdirectory: folder } : {}) }, inventory: await inventory(destination) };
}
export async function acquire(source: string, destination: string, requested?: string): Promise<{ source: Source; inventory: Inventory }> {
  await ensureDirectory(destination);
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) return acquireGithub(source, destination, requested);
  const local = await chooseLocal(source, requested);
  return { source: { kind: 'local', locator: local }, inventory: await inventory(local, destination) };
}
