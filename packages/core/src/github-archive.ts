import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { HoneySkillError } from './storage.js';

export const GITHUB_LIMITS = { compressedBytes: 8 * 1024 * 1024, archiveBytes: 32 * 1024 * 1024, entries: 4096 } as const;
export interface ArchiveFile { path: string; content: Buffer; executable: boolean }
export function remainingTime(deadline: number): number {
  const remaining = Math.ceil(deadline - performance.now());
  if (remaining <= 0) throw new HoneySkillError('DOWNLOAD_TIMEOUT', 'GitHub collection timed out.');
  return remaining;
}
export async function resolveGithubRevision(owner: string, repo: string, reference: string, deadline: number): Promise<string> {
  remainingTime(deadline);
  if (/^[a-f0-9]{40}$/.test(reference)) return reference;
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'honeyskill-git-')));
  try {
    const refs = reference === 'HEAD' ? ['HEAD'] : [`refs/heads/${reference}`, `refs/tags/${reference}`, `refs/tags/${reference}^{}`];
    const stdout = await new Promise<string>((resolve, reject) => {
      let child: ChildProcess | undefined, settled = false, bytes = 0, output = '';
      const stopGroup = () => {
        if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
      };
      const finish = (error?: HoneySkillError, output = '') => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (error) { stopGroup(); reject(error); } else resolve(output);
      };
      // Arm independently: a surviving HTTP helper can keep its parent's pipes open.
      const timer = setTimeout(() => finish(new HoneySkillError('DOWNLOAD_TIMEOUT', 'GitHub reference resolution timed out.')), remainingTime(deadline));
      try {
        child = spawn('/usr/bin/git', ['-c', 'credential.helper=', '-c', 'core.askPass=', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'http.extraHeader=', '-c', 'http.proxy=', '-c', 'http.followRedirects=false', '-c', 'http.sslVerify=true', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', 'ls-remote', '--exit-code', `https://github.com/${owner}/${repo}.git`, ...refs], {
          cwd: directory, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
          env: { PATH: '/usr/bin:/bin', HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CEILING_DIRECTORIES: path.dirname(directory), GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '/usr/bin/false', LC_ALL: 'C' },
        });
      } catch { finish(new HoneySkillError('GITHUB_REVISION', 'Public GitHub revision could not be resolved. Git is required; no credentials were used.')); return; }
      const countOutput = (chunk: Buffer) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 64 * 1024) finish(new HoneySkillError('GITHUB_REVISION', 'GitHub reference response exceeds the size limit.'));
      };
      child.stdout?.on('data', (chunk: Buffer) => { countOutput(chunk); if (!settled) output += chunk.toString('utf8'); });
      child.stderr?.on('data', countOutput);
      child.once('error', () => finish(new HoneySkillError('GITHUB_REVISION', 'Public GitHub revision could not be resolved. Git is required; no credentials were used.')));
      child.once('exit', (code, signal) => { if (code !== 0 || signal) finish(new HoneySkillError('GITHUB_REVISION', 'GitHub reference process failed.')); });
      child.once('close', (code, signal) => finish(code === 0 && !signal ? undefined : new HoneySkillError('GITHUB_REVISION', 'GitHub reference process failed.'), output));
    });
    remainingTime(deadline);
    const matches = new Map<string, string>();
    for (const line of stdout.trim().split('\n')) {
      const match = /^([a-f0-9]{40})\t(.+)$/.exec(line);
      if (!match || !refs.includes(match[2]!) || matches.has(match[2]!)) throw new HoneySkillError('GITHUB_REVISION', 'Unexpected GitHub reference response.');
      matches.set(match[2]!, match[1]!);
    }
    const branch = matches.get(refs[0]!), tag = matches.get(refs[2]!) ?? matches.get(refs[1]!);
    if (branch && tag && branch !== tag) throw new HoneySkillError('GITHUB_REVISION', 'Branch and tag are ambiguous. Use a full commit SHA.');
    const revision = branch ?? tag;
    if (!revision) throw new HoneySkillError('GITHUB_REVISION', 'GitHub revision could not be resolved.');
    return revision;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
export async function downloadGithubArchive(owner: string, repo: string, revision: string, deadline: number): Promise<Buffer> {
  const signal = AbortSignal.timeout(remainingTime(deadline));
  try {
    const response = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/${revision}`, { redirect: 'error', signal, headers: { Accept: 'application/x-gzip', 'User-Agent': 'honeyskill-local' } });
    if (!response.ok) throw new HoneySkillError('GITHUB_ERROR', `GitHub archive HTTP ${response.status}. Check the public repository and revision, or retry later.`);
    if (!['application/x-gzip', 'application/gzip', 'application/octet-stream'].includes(response.headers.get('content-type')?.split(';')[0]?.trim() ?? '')) throw new HoneySkillError('GITHUB_TYPE', 'Unexpected GitHub archive response.');
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > GITHUB_LIMITS.compressedBytes)) { await response.body?.cancel(); throw new HoneySkillError('DOWNLOAD_LIMIT', 'GitHub compressed archive exceeds the size limit.'); }
    const reader = response.body?.getReader();
    if (!reader) throw new HoneySkillError('GITHUB_ERROR', 'Empty GitHub archive response.');
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        remainingTime(deadline);
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > GITHUB_LIMITS.compressedBytes) throw new HoneySkillError('DOWNLOAD_LIMIT', 'GitHub compressed archive exceeds the size limit.');
        chunks.push(chunk.value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    remainingTime(deadline);
    let archive: Buffer;
    try { archive = gunzipSync(Buffer.concat(chunks), { maxOutputLength: GITHUB_LIMITS.archiveBytes }); }
    catch (error) { throw new HoneySkillError((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE' ? 'DOWNLOAD_LIMIT' : 'INVALID_ARCHIVE', 'GitHub archive is invalid, truncated, or exceeds the decompressed size limit.'); }
    remainingTime(deadline);
    return archive;
  } catch (error) {
    if (signal.aborted) throw new HoneySkillError('DOWNLOAD_TIMEOUT', 'GitHub archive download timed out.');
    if (error instanceof HoneySkillError) throw error;
    throw new HoneySkillError('GITHUB_ERROR', 'GitHub archive download failed. No credentials were used.');
  }
}
/** Strict Git-generated ustar subset. No system extractor or acquired code is executed. */
export function parseGithubArchive(archive: Buffer, repo: string, revision: string, deadline: number): ArchiveFile[] {
  const invalid = (message: string): never => { throw new HoneySkillError('INVALID_ARCHIVE', message); };
  const text = (bytes: Buffer): string => {
    const nul = bytes.indexOf(0);
    if (nul >= 0 && bytes.subarray(nul).some(byte => byte !== 0)) invalid('Ambiguous archive text field.');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(nul < 0 ? bytes : bytes.subarray(0, nul)); }
    catch { return invalid('Invalid UTF-8 in archive metadata.'); }
  };
  const octal = (bytes: Buffer): number => {
    if (bytes.some(byte => byte > 127)) invalid('Unsupported archive numeric encoding.');
    const value = bytes.toString('ascii').replace(/[\0 ]+$/, '').replace(/^ +/, '');
    if (!/^[0-7]+$/.test(value)) invalid('Invalid archive numeric field.');
    const number = Number.parseInt(value, 8);
    if (!Number.isSafeInteger(number)) invalid('Archive numeric field exceeds the supported range.');
    return number;
  };
  const root = `${repo}-${revision}`, files: ArchiveFile[] = [], seen = new Map<string, string>();
  let archiveRoot: string | undefined;
  let offset = 0, entries = 0, commitSeen = false, rootSeen = false, ended = false;
  if (archive.length > GITHUB_LIMITS.archiveBytes || archive.length < 1024 || archive.length % 512) invalid('Invalid archive size or truncated record.');
  while (offset < archive.length) {
    remainingTime(deadline);
    const header = archive.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      if (archive.length - offset < 1024 || archive.subarray(offset).some(byte => byte !== 0)) invalid('Missing archive end blocks or unexpected trailing data.');
      ended = true; break;
    }
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (octal(header.subarray(148, 156)) !== checksum || !header.subarray(257, 265).equals(Buffer.from('ustar\0' + '00'))) invalid('Invalid archive checksum or unsupported format.');
    const name = text(header.subarray(0, 100)), prefix = text(header.subarray(345, 500));
    const file = prefix ? `${prefix}/${name}` : name, type = String.fromCharCode(header[156]!), size = octal(header.subarray(124, 136)), mode = octal(header.subarray(100, 108));
    const start = offset + 512, next = start + Math.ceil(size / 512) * 512;
    if (next > archive.length || !Number.isSafeInteger(next)) invalid('Truncated archive entry.');
    if (archive.subarray(start + size, next).some(byte => byte !== 0)) invalid('Nonzero archive entry padding.');
    if (++entries > GITHUB_LIMITS.entries) throw new HoneySkillError('DOWNLOAD_LIMIT', 'GitHub archive contains too many entries.');
    if (type === 'g') {
      if (offset !== 0 || file !== 'pax_global_header' || !archive.subarray(start, start + size).equals(Buffer.from(`52 comment=${revision}\n`))) invalid('Unsupported archive metadata or mismatched commit SHA.');
      commitSeen = true; offset = next; continue;
    }
    if (!['0', '\0', '5'].includes(type) || text(header.subarray(157, 257)) || (mode & ~0o777)) throw new HoneySkillError('UNSAFE_ENTRY', 'Archive links, special entries, extended path overrides, and special permissions are refused.');
    const directory = type === '5', canonical = directory && file.endsWith('/') ? file.slice(0, -1) : file;
    if (!canonical || canonical.length > 1024 || canonical.normalize('NFC') !== canonical || /[\x00-\x1f\x7f:\\]/.test(canonical) || canonical.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) throw new HoneySkillError('UNSAFE_PATH', 'Unsafe or ambiguous archive path refused.');
    const component = canonical.split('/')[0]!;
    if (!component.endsWith(`-${revision}`) || component.slice(0, -41).toLowerCase() !== repo.toLowerCase() || (archiveRoot !== undefined && component !== archiveRoot)) invalid('Archive root does not match the repository and commit SHA.');
    archiveRoot = component;
    const identity = canonical.toLowerCase();
    if (seen.has(identity)) invalid('Duplicate or case-ambiguous archive path.');
    for (let parent = path.posix.dirname(identity); parent !== '.'; parent = path.posix.dirname(parent)) if (seen.get(parent) === 'file') invalid('Archive file conflicts with a parent directory.');
    if (!directory && [...seen.keys()].some(existing => existing.startsWith(`${identity}/`))) invalid('Archive file conflicts with a child path.');
    seen.set(identity, directory ? 'directory' : 'file');
    if (canonical === archiveRoot) { if (!directory) invalid('Archive root must be a directory.'); rootSeen = true; }
    if (directory) { if (size) invalid('Archive directory has unexpected content.'); }
    else {
      if (path.posix.basename(canonical) === '.gitmodules') throw new HoneySkillError('UNSAFE_ENTRY', 'Archives declaring Git submodules are unsupported.');
      files.push({ path: canonical.slice(root.length + 1), content: archive.subarray(start, start + size), executable: !!(mode & 0o111) });
    }
    offset = next;
  }
  if (!commitSeen || !rootSeen || !ended) invalid('Missing commit metadata, repository root, or archive end blocks.');
  return files;
}
