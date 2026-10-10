import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ROOT } from './runner.js';

const slug = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const label = z.enum(['benign', 'malicious']);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal('synthetic'), attackerAddress: z.string().regex(/^0x[a-f0-9]{40}$/i),
  fixtures: z.array(z.object({ id: slug, folder: slug, label }).passthrough()).min(1),
}).passthrough();
const freezeSchema = z.object({
  schemaVersion: z.literal(1), datasetSha256: digest,
  files: z.record(z.string(), digest), labels: z.record(z.string(), label),
}).passthrough();

export function validateCorpusIdentifier(value: string): string {
  if (!slug.safeParse(value).success) throw new Error('--corpus must be a lowercase alphanumeric slug with single hyphens.');
  return value;
}

async function readRegular(root: string, relative: string): Promise<Buffer> {
  // All relative paths come from the required set below, never directly from freeze metadata.
  let current = root;
  const segments = relative.split('/');
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const details = await lstat(current);
    if (details.isSymbolicLink() || (index === segments.length - 1 ? !details.isFile() : !details.isDirectory())) {
      throw new Error(`Corpus path must use regular files and directories without symlinks: ${relative}.`);
    }
  }
  return readFile(current);
}

/** Verifies a complete frozen dataset before any fork setup or paid model request. */
export async function loadCorpus(identifier = 'fixtures', root = ROOT) {
  validateCorpusIdentifier(identifier);
  const directory = identifier === 'fixtures' ? 'fixtures' : `corpora/${identifier}`;
  const manifestPath = `${directory}/manifest.json`;
  const manifestBytes = await readRegular(root, manifestPath);
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
  const freeze = freezeSchema.parse(JSON.parse((await readRegular(root, `${directory}/freeze.json`)).toString('utf8')));
  const ids = manifest.fixtures.map(fixture => fixture.id), folders = manifest.fixtures.map(fixture => fixture.folder);
  if (new Set(ids).size !== ids.length || new Set(folders).size !== folders.length) throw new Error('Corpus fixture IDs and folders must be unique.');
  if (Object.keys(freeze.labels).length !== ids.length || manifest.fixtures.some(fixture => freeze.labels[fixture.id] !== fixture.label)) {
    throw new Error('Frozen labels do not match the selected corpus manifest.');
  }
  const expectedFiles = ['data/address-book.json', 'data/tasks.json', manifestPath, ...folders.map(folder => `${directory}/${folder}/SKILL.md`)].sort();
  if (JSON.stringify(Object.keys(freeze.files).sort()) !== JSON.stringify(expectedFiles)) {
    throw new Error('Freeze must cover exactly the selected manifest, every selected SKILL.md, and shared address-book/tasks data.');
  }
  const actualFolders = (await readdir(path.join(root, directory), { withFileTypes: true })).filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => entry.name).sort();
  if (JSON.stringify(actualFolders) !== JSON.stringify([...folders].sort())) throw new Error('Corpus folders do not match the manifest; every fixture must be selected exactly once.');
  const sortedFiles = Object.fromEntries(Object.entries(freeze.files).sort(([a], [b]) => a.localeCompare(b)));
  if (createHash('sha256').update(JSON.stringify(sortedFiles)).digest('hex') !== freeze.datasetSha256) {
    throw new Error('Frozen dataset digest does not match its canonical file-hash map.');
  }
  for (const file of expectedFiles) {
    const bytes = file === manifestPath ? manifestBytes : await readRegular(root, file);
    if (createHash('sha256').update(bytes).digest('hex') !== freeze.files[file]) {
      throw new Error(`Frozen dataset changed: ${file}. Do not rewrite it to improve scores.`);
    }
  }
  return { identifier, folder: path.join(root, directory), manifest, freeze };
}
