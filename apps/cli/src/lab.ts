import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLabRoot, initProject, scanSkill, installScan, exceptionConfirmation, fullPipelineComplete, OpenAIResponsesProvider, sanitizeTerminal, type ScanOptions, type ScanReport, type InstallRecord } from '../../../packages/core/src/index.js';
import { ensureDirectory, exists, atomicJson } from '../../../packages/core/src/storage.js';
import { createBehavioralProvider, checkPrerequisites } from '../../../packages/skillguard-lite/src/install-adapter.js';
import { fullReportMarkdown, fullReportHtml } from './full-report.js';
import { question } from './interaction.js';

const marker = '.skillgate-lab.json';
const model = 'gpt-6-luna';
export async function initializeLab(directory?: string, cwd = process.cwd()): Promise<string> {
  const root = resolve(directory ?? (await exists(join(cwd, marker)) ? cwd : join(cwd, 'skillgate-lab')));
  // Only a new/empty dedicated directory can acquire the marker. Existing projects cannot opt in accidentally.
  if (root === homedir() || root === sep || root.split(sep).some(part => ['.agents', '.codex', '.claude', '.cursor', '.openclaw'].includes(part)) ||
      [process.env.CODEX_HOME, process.env.CLAUDE_CONFIG_DIR].some(value => value && (root === resolve(value) || root.startsWith(resolve(value) + sep)))) {
    throw new Error('Use a dedicated lab directory outside real agent profiles.');
  }
  await ensureDirectory(root);
  if (!await exists(join(root, marker))) {
    if ((await readdir(root)).length) throw new Error('Lab directory is not empty and has no valid lab marker. Choose a new directory with --lab.');
    await writeFile(join(root, marker), JSON.stringify({ schemaVersion: 1, kind: 'skillgate-test-lab' }) + '\n', { flag: 'wx', mode: 0o600 });
  }
  await assertLabRoot(root);
  await initProject(root, { profile: 'full', semanticConsent: true, model });
  return root;
}

export async function labStatus(directory?: string) {
  const root = await initializeLab(directory);
  return { root, model, target: join(root, '.agents', 'skills'), ...(await checkPrerequisites()) };
}

async function demoSource(root: string, alias: 'good' | 'trap') {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, 'lab-skills', alias, 'SKILL.md.fixture'), join(here, '../../../packages/skillguard-lite/lab-fixtures', alias, 'SKILL.md.fixture')];
  const fixture = await Promise.all(candidates.map(async path => await exists(path) ? path : undefined));
  const path = fixture.find(Boolean);
  if (!path) throw new Error('Bundled demonstration skill is missing. Reinstall HoneySkill.');
  const directory = join(root, '.skillgate', 'examples', alias);
  await ensureDirectory(directory);
  const destination = join(directory, 'SKILL.md');
  const contents = await readFile(path, 'utf8');
  if (await exists(destination)) {
    const info = await lstat(destination);
    if (!info.isFile() || info.nlink !== 1 || await readFile(destination, 'utf8') !== contents) throw new Error('The bundled example copy was modified. Use a new --lab directory.');
  } else await writeFile(destination, contents, { flag: 'wx', mode: 0o600 });
  return directory;
}

/** Hidden, process-local credential input; never persisted, echoed or passed as an argument. */
export function hiddenApiKey(): Promise<string> {
  if (!process.stdin.isTTY) return Promise.resolve('');
  return new Promise((resolveKey, reject) => {
    let value = '';
    const previousRaw = process.stdin.isRaw;
    const finish = (cancelled: boolean) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(previousRaw); process.stdin.pause();
      process.stderr.write('\n');
      if (cancelled) reject(Object.assign(new Error('Cancelled before analysis.'), { exitCode: 130 }));
      else resolveKey(value.trim());
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004' || character === '\u001b') { finish(true); return; }
        if (character === '\r' || character === '\n') { finish(false); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && value.length < 1024) value += character;
      }
    };
    process.stderr.write('OpenAI API key (hidden, used only for this command; Enter skips): ');
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data', onData);
  });
}

export interface TryOptions {
  lab?: string; skill?: string; interactive?: boolean; json?: boolean;
  // Explicit injection seams for deterministic tests; the public command always uses real providers.
  providers?: Pick<ScanOptions, 'provider' | 'behavioralProvider'>;
  choose?: (prompt: string) => Promise<string>;
  output?: (text: string) => void;
}

export async function tryInstallation(source: string, options: TryOptions = {}) {
  const root = await initializeLab(options.lab);
  const write = options.output ?? (text => process.stderr.write(sanitizeTerminal(text)));
  const keyBefore = process.env.OPENAI_API_KEY;
  let prompted = false;
  try {
    if (!options.providers && !process.env.OPENAI_API_KEY && options.interactive && !options.json) {
      process.env.OPENAI_API_KEY = await hiddenApiKey(); prompted = true;
    }
    if (!options.json) write(`Lab: ${root}\nModel: ${model} (reasoning: none). Skill text is sent to the paid OpenAI API. Payments use a disposable local Fuji fork.\n`);
    let input = source;
    if (source === 'good' || source === 'trap') {
      input = await demoSource(root, source);
      if (!options.json) write(`Bundled synthetic ${source === 'good' ? 'benign' : 'malicious'} demonstration fixture.\n`);
    } else if (!await exists(resolve(source)) && /^[\w.-]+\/[\w.-]+$/.test(source)) input = `https://github.com/${source}`;
    const providers = options.providers ?? {
      provider: process.env.OPENAI_API_KEY ? new OpenAIResponsesProvider(process.env.OPENAI_API_KEY) : undefined,
      behavioralProvider: createBehavioralProvider({ evidenceDirectory: join(root, '.skillgate', 'evidence'), progress: text => { if (!options.json) write(`  ${text}\n`); } }),
    };
    const report = await scanSkill(root, input, { ...providers, skill: options.skill, progress: (stage, detail) => {
      if (!options.json) write(`[${stage === 'native' ? '1/3 regex' : stage === 'semantic' ? '2/3 LLM' : '3/3 execution'}] ${detail}\n`);
    } });
    const reports = await saveLabReports(root, report);
    if (!options.json) write(`\n${trialSummary(report)}\nFull report: ${reports.html}\n`);
    let installation: InstallRecord | undefined;
    if (report.decision === 'allow') installation = await installScan(root, report.id);
    else if (fullPipelineComplete(report) && options.interactive && !options.json) {
      write(`\nHeld before activation. Destination: ${join(root, '.agents', 'skills', report.name)}\n[1] Do not install (default)\n[2] Install despite the risk\n`);
      const choice = await (options.choose ?? question)('Your choice [1/2]: ');
      if (choice.trim() === '2') installation = await installScan(root, report.id, {
        fingerprint: report.fingerprint, destination: join(root, '.agents', 'skills', report.name),
        confirmation: exceptionConfirmation(report), operator: userInfo().username, reason: 'Explicit interactive lab override after the complete report.',
      });
    }
    const status = installation?.status ?? (fullPipelineComplete(report) ? 'held' : 'unverified');
    // Separate security verdict and installation decision: overriding never rewrites a malicious finding.
    const outcome = { lab: root, status, report, reports, ...(installation ? { installation } : {}) };
    await atomicJson(join(root, 'reports', `${report.id}.outcome.json`), outcome);
    return outcome;
  } finally {
    if (prompted) { if (keyBefore === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = keyBefore; }
  }
}

async function saveLabReports(root: string, report: ScanReport) {
  const directory = join(root, 'reports'); await ensureDirectory(directory);
  const paths = { json: join(directory, `${report.id}.json`), markdown: join(directory, `${report.id}.md`), html: join(directory, `${report.id}.html`) };
  for (const [path, content] of [[paths.json, JSON.stringify(report, null, 2)], [paths.markdown, fullReportMarkdown(report)], [paths.html, fullReportHtml(report)]]) {
    await writeFile(path!, content! + '\n', { flag: 'wx', mode: 0o600 });
  }
  return paths;
}

function trialSummary(report: ScanReport): string {
  const lines = [`${report.name} · ${(report.durationMs / 1000).toFixed(1)} seconds`];
  for (const stage of report.analyses) lines.push(`${stage.stage === 'native' ? 'Regex' : stage.stage === 'semantic' ? 'LLM' : 'Execution'}: ${stage.status.toUpperCase()}`);
  for (const finding of report.findings.slice(0, 3)) {
    lines.push(`${finding.category}: ${finding.financialConsequence}`);
    const evidence = finding.evidence[0];
    if (evidence) lines.push(`  ${evidence.file}:${evidence.line} — ${evidence.excerpt}`);
  }
  const behavior = report.behavioral;
  if (behavior) lines.push(`Behavior: ${behavior.verdict} · Baseline: ${behavior.baselineVerdict} · ${behavior.violations.length} recipient violation(s)`);
  const violation = behavior?.violations[0];
  if (violation) lines.push(`Task: ${violation.task}`, `Expected: ${violation.expectedRecipients.join(', ')}`, `Observed: ${violation.actualRecipient} (${violation.amountAVAX} AVAX)`);
  for (const error of [...report.coverage.errors, ...report.coverage.unresolved, ...report.coverage.limitsReached].slice(0, 5)) lines.push(`Incomplete: ${error}`);
  if (!fullPipelineComplete(report) && behavior?.reason) lines.push(behavior.reason);
  lines.push('Scope: six AVAX tasks, local fork only; acquired scripts are not executed.');
  return lines.join('\n');
}
