import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { startFork } from './chain.js';
import { auditSkill, benchmarkTable, classificationMetrics, DEFAULT_MODEL, ROOT, type BenchmarkRow } from './runner.js';
import { compareSkill, comparisonMetrics, comparisonTable, type ComparisonRow } from './comparison.js';
import { TEXT_REVIEW_PROMPT } from './text-review.js';

function parse(argv: string[]) {
  const [command, ...args] = argv;
  if (!command || command === '--help' || command === 'help') return { command: 'help' };
  if (!['audit', 'benchmark', 'benchmark-behavioral', 'check-fork'].includes(command)) throw new Error('Use audit <skill-folder>, benchmark, benchmark-behavioral, or check-fork.');
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
    console.log('SkillGuard-Lite — behavioral recipient-substitution audit\n\npnpm run audit <skill-folder> [--model MODEL] [--block FUJI_BLOCK] [--out FILE.json]\npnpm benchmark [--model MODEL] [--block FUJI_BLOCK] [--out FILE.json]\n  Compare a text-only model review against SkillGuard-Lite on the same frozen skills.\npnpm benchmark:behavioral [--model MODEL] [--block FUJI_BLOCK] [--out FILE.json]\n  Behavioral-only historical protocol.\npnpm check:fork\n\nRequires a valid OPENAI_API_KEY and Anvil. Only locally owned Fuji-fork wallets can send.\nThe text-only baseline uses the OpenAI API, not the ChatGPT web app.\nBENIGN means no provenance violation observed in the fixed battery, not safety certification.'); return;
  }
  const startedAt = new Date().toISOString();
  // Local check is useful before configuring the model. Never substitute mock results in this script.
  if (options.command !== 'check-fork' && !process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required. No live audit was performed.');
  const initial = { schemaVersion: 1, kind: 'behavioral-run-in-progress', command: options.command, provider: 'openai', model: options.model, startedAt, complete: false,
    ...(options.command === 'benchmark' ? { comparisonProtocol: { version: 1, textReviewPrompt: TEXT_REVIEW_PROMPT, textReviewPromptSha256: createHash('sha256').update(TEXT_REVIEW_PROMPT).digest('hex'), baseline: 'GPT model text-only review through the API; not the ChatGPT application', behavioral: 'SkillGuard-Lite: fresh six-task with/without-skill audit on a local Fuji fork', ordering: 'text first on even fixture indices; behavioral first on odd indices', sameRawSkills: true, labelsAndFixtureIdsHiddenFromReviewer: true, noArchivedResponseReuse: true, scoring: 'author labels; shared complete-pair denominator; incomplete pairs excluded and counted', compute: 'one model response for text review versus multiple model calls and local transfers for the behavioral method; report both costs in tokens and elapsed time' } } : {}) };
  // Reserve every destination before any model or fork work. Existing evidence is never overwritten.
  await save(options.output!, initial);
  const tablePath = options.output!.replace(/\.json$/i, '') + '.md';
  if (options.command === 'benchmark' || options.command === 'benchmark-behavioral') {
    try { await writeFile(tablePath, '# Benchmark not started\n', { flag: 'wx' }); }
    catch { await writeFile(options.output!, JSON.stringify({ ...initial, error: 'Table destination is not writable or already exists; no execution started.' }, null, 2) + '\n'); throw new Error('Table destination is not writable or already exists; no execution started.'); }
  }
  let latest: unknown = initial;
  const persist = async (data: unknown) => { latest = data; await writeFile(options.output!, JSON.stringify(data, null, 2) + '\n'); };
  let session: Awaited<ReturnType<typeof startFork>> | undefined;
  try {
    const forkStarted = performance.now();
    session = await startFork({ forkBlockNumber: options.forkBlockNumber });
    const forkSetupMs = performance.now() - forkStarted;
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
    if (options.command === 'benchmark') {
      const rows: ComparisonRow[] = [];
      const metadata = { ...initial, kind: 'actual-openai-paired-skill-comparison', forkBlockNumber: session.forkBlockNumber, chainId: session.chainId, forkSetupMs, datasetSha256: freeze.datasetSha256, expectedFixtureCount: manifest.fixtures.length };
      for (const [index, fixture] of manifest.fixtures.entries()) {
        const result = await compareSkill({ folder: path.join(ROOT, 'fixtures', fixture.folder), model: options.model ?? DEFAULT_MODEL, chain: session, order: index % 2 === 0 ? 'text-first' : 'behavioral-first', progress: message => console.error(message) });
        rows.push({ ...result, label: fixture.label });
        await persist({ ...metadata, executedFixtureCount: rows.length, rows, metrics: comparisonMetrics(rows) });
        await writeFile(tablePath, '# In-progress paired comparison\n\n' + comparisonTable(rows));
        if ([result.textReview.error ?? '', ...result.behavioral.errors].some(error => /OpenAI API|client unavailable|Local fork reset failed/.test(error))) break;
      }
      const metrics = comparisonMetrics(rows);
      const complete = rows.length === manifest.fixtures.length && metrics.pairedScored === manifest.fixtures.length;
      await persist({ ...metadata, completedAt: new Date().toISOString(), complete, executedFixtureCount: rows.length, notRun: manifest.fixtures.slice(rows.length).map(f => f.id), fixtures: 'authored synthetic; frozen before live execution', rows, metrics });
      const table = `# Text-only model review vs SkillGuard-Lite\n\nModel: ${options.model} · Fuji fork block ${session.forkBlockNumber} · ${complete ? 'Complete real paired execution' : 'INCOMPLETE comparison'}\n\n${comparisonTable(rows)}\nFork startup: ${(forkSetupMs / 1000).toFixed(2)} seconds, reported separately from method timings.\n`;
      await writeFile(tablePath, table);
      console.log(table); console.log(`Evidence: ${options.output}\nTable: ${tablePath}`);
      if (!complete) process.exitCode = 1;
      return;
    }
    const rows: BenchmarkRow[] = [];
    for (const fixture of manifest.fixtures) {
      const audit = await auditSkill({ folder: path.join(ROOT, 'fixtures', fixture.folder), model: options.model, chain: session, progress: message => console.error(message) });
      rows.push({ skill: fixture.id, label: fixture.label, audit });
      await persist({ ...initial, kind: 'actual-openai-local-fuji-fork-benchmark', forkBlockNumber: session.forkBlockNumber, chainId: session.chainId, datasetSha256: freeze.datasetSha256, expectedFixtureCount: manifest.fixtures.length, executedFixtureCount: rows.length, rows, metrics: classificationMetrics(rows) });
      await writeFile(tablePath, '# In-progress behavioral benchmark\n\n' + benchmarkTable(rows));
      // Do not repeat an authentication/billing/network failure across an entire paid benchmark.
      if (audit.errors.some(error => /OpenAI API|client unavailable|Local fork reset failed/.test(error))) break;
    }
    const complete = rows.length === manifest.fixtures.length && rows.every(row => row.audit.complete);
    const result = { schemaVersion: 1, kind: 'actual-openai-local-fuji-fork-benchmark', provider: 'openai', model: options.model, startedAt, completedAt: new Date().toISOString(), forkBlockNumber: session.forkBlockNumber, chainId: session.chainId, datasetSha256: freeze.datasetSha256, fixtures: 'authored synthetic; frozen before live execution', expectedFixtureCount: manifest.fixtures.length, executedFixtureCount: rows.length, complete, notRun: manifest.fixtures.slice(rows.length).map(f => f.id), metrics: classificationMetrics(rows), inputTokens: rows.reduce((n,r)=>n+r.audit.inputTokens,0), outputTokens: rows.reduce((n,r)=>n+r.audit.outputTokens,0), rows };
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
