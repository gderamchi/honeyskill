import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { startFork } from './chain.js';
import { auditSkill, benchmarkTable, classificationMetrics, DEFAULT_MODEL, ROOT, type BenchmarkRow } from './runner.js';

function parse(argv: string[]) {
  const [command, ...args] = argv;
  if (!command || command === '--help' || command === 'help') return { command: 'help' };
  if (!['audit', 'benchmark', 'check-fork'].includes(command)) throw new Error('Use audit <skill-folder>, benchmark, or check-fork.');
  let folder: string | undefined, model = DEFAULT_MODEL, output: string | undefined, forkBlockNumber: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (['--model', '--out', '--block'].includes(arg)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
      if (arg === '--model') model = value;
      else if (arg === '--out') output = value;
      else { forkBlockNumber = Number(value); if (!/^\d+$/.test(value) || !Number.isSafeInteger(forkBlockNumber) || forkBlockNumber < 1) throw new Error('--block must be a positive integer.'); }
    } else if (command === 'audit' && !arg.startsWith('-') && !folder) folder = arg;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (command === 'audit' && !folder) throw new Error('audit requires a skill folder containing SKILL.md.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return { command, folder, model, forkBlockNumber, output: path.resolve(output ?? `outputs/skillguard-lite/${command}-${stamp}.json`) };
}
async function save(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
async function verifyFixtureFreeze() {
  const freeze = z.object({ datasetSha256: z.string(), files: z.record(z.string(), z.string()), labels: z.record(z.string(), z.enum(['benign', 'malicious'])) }).parse(JSON.parse(await readFile(path.join(ROOT, 'fixtures/freeze.json'), 'utf8')));
  for (const [file, expected] of Object.entries(freeze.files)) {
    if (path.isAbsolute(file) || file.split('/').includes('..')) throw new Error('Invalid fixture freeze path.');
    const bytes = await readFile(path.join(ROOT, file));
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Frozen dataset changed: ${file}. Do not rewrite it to improve scores.`);
  }
  return freeze;
}
async function main() {
  const options = parse(process.argv.slice(2));
  if (options.command === 'help') {
    console.log('SkillGuard-Lite — behavioral recipient-substitution audit\n\npnpm run audit <skill-folder> [--model MODEL] [--block FUJI_BLOCK] [--out FILE.json]\npnpm benchmark [--model MODEL] [--block FUJI_BLOCK] [--out FILE.json]\npnpm check:fork\n\nRequires a valid ANTHROPIC_API_KEY and Anvil. Only locally owned Fuji-fork wallets can send.\nBENIGN means no provenance violation observed in the fixed battery, not safety certification.'); return;
  }
  const startedAt = new Date().toISOString();
  // Local check is useful before configuring the model. Never substitute mock results in this script.
  if (options.command !== 'check-fork' && !process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required. No live audit was performed.');
  const initial = { schemaVersion: 1, kind: 'behavioral-run-in-progress', command: options.command, model: options.model, startedAt, complete: false };
  // Reserve every destination before any model or fork work. Existing evidence is never overwritten.
  await save(options.output!, initial);
  const tablePath = options.output!.replace(/\.json$/i, '') + '.md';
  if (options.command === 'benchmark') {
    try { await writeFile(tablePath, '# Benchmark not started\n', { flag: 'wx' }); }
    catch { await writeFile(options.output!, JSON.stringify({ ...initial, error: 'Table destination is not writable or already exists; no execution started.' }, null, 2) + '\n'); throw new Error('Table destination is not writable or already exists; no execution started.'); }
  }
  let latest: unknown = initial;
  const persist = async (data: unknown) => { latest = data; await writeFile(options.output!, JSON.stringify(data, null, 2) + '\n'); };
  let session: Awaited<ReturnType<typeof startFork>> | undefined;
  try {
    session = await startFork({ forkBlockNumber: options.forkBlockNumber });
    if (options.command === 'check-fork') {
      const result = { kind: 'actual-local-fuji-fork-check', chainId: session.chainId, forkBlockNumber: session.forkBlockNumber, agentAddress: session.agentAddress, balanceAVAX: await session.balance(), localOnly: true, startedAt, completedAt: new Date().toISOString() };
      await persist(result); console.log(JSON.stringify(result, null, 2)); console.log(`Evidence: ${options.output}`); return;
    }
    if (options.command === 'audit') {
      const result = await auditSkill({ folder: options.folder!, model: options.model, chain: session, progress: message => console.error(message) });
      await persist(result);
      console.log(`${result.verdict}: ${result.skill}\n${result.reason}\nBaseline: ${result.baselineVerdict}; violations: ${result.violations.length}; complete: ${result.complete}\nEvidence: ${options.output}`);
      process.exitCode = result.verdict === 'ERROR' || !result.complete ? 1 : 0;
      return;
    }
    const freeze = await verifyFixtureFreeze();
    const manifest = z.object({ kind: z.literal('synthetic'), attackerAddress: z.string(), fixtures: z.array(z.object({ id: z.string(), folder: z.string().regex(/^[a-z0-9-]+$/), label: z.enum(['benign', 'malicious']) })).min(1) }).parse(JSON.parse(await readFile(path.join(ROOT, 'fixtures/manifest.json'), 'utf8')));
    const rows: BenchmarkRow[] = [];
    for (const fixture of manifest.fixtures) {
      const audit = await auditSkill({ folder: path.join(ROOT, 'fixtures', fixture.folder), model: options.model, chain: session, progress: message => console.error(message) });
      rows.push({ skill: fixture.id, label: fixture.label, audit });
      await persist({ ...initial, kind: 'actual-claude-local-fuji-fork-benchmark', forkBlockNumber: session.forkBlockNumber, chainId: session.chainId, datasetSha256: freeze.datasetSha256, expectedFixtureCount: manifest.fixtures.length, executedFixtureCount: rows.length, rows, metrics: classificationMetrics(rows) });
      await writeFile(tablePath, '# In-progress behavioral benchmark\n\n' + benchmarkTable(rows));
      // Do not repeat an authentication/billing/network failure across an entire paid benchmark.
      if (audit.errors.some(error => /Claude API|client unavailable|Local fork reset failed/.test(error))) break;
    }
    const complete = rows.length === manifest.fixtures.length && rows.every(row => row.audit.complete);
    const result = { schemaVersion: 1, kind: 'actual-claude-local-fuji-fork-benchmark', model: options.model, startedAt, completedAt: new Date().toISOString(), forkBlockNumber: session.forkBlockNumber, chainId: session.chainId, datasetSha256: freeze.datasetSha256, fixtures: 'authored synthetic; frozen before live execution', expectedFixtureCount: manifest.fixtures.length, executedFixtureCount: rows.length, complete, notRun: manifest.fixtures.slice(rows.length).map(f => f.id), metrics: classificationMetrics(rows), inputTokens: rows.reduce((n,r)=>n+r.audit.inputTokens,0), outputTokens: rows.reduce((n,r)=>n+r.audit.outputTokens,0), rows };
    await persist(result);
    const table = `# SkillGuard-Lite behavioral benchmark\n\nModel: ${options.model} · Fuji fork block ${session.forkBlockNumber} · ${complete ? 'Complete real execution' : 'INCOMPLETE — not a finished benchmark'}\n\n${benchmarkTable(rows)}\nSynthetic fixture labels; one execution per task/arm, no cached baseline. BENIGN is limited to the tested battery and literal provenance oracle.\n`;
    await writeFile(tablePath, table);
    console.log(table); console.log(`Evidence: ${options.output}\nTable: ${tablePath}`);
    if (!complete) { console.error(`Not run: ${result.notRun.join(', ') || 'none; see incomplete rows'}`); process.exitCode = 1; }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution failed.';
    await persist({ ...(latest as Record<string, unknown>), complete: false, failedAt: new Date().toISOString(), error: message }).catch(() => {});
    throw error;
  } finally { await session?.close(); }
}
main().catch(error => { console.error(`ERROR: ${error instanceof Error ? error.message : 'Audit failed.'}`); process.exitCode = 1; });
