import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { reviewSecurity } from '../../../packages/security-lab/src/review.js';
import { runSecurityBenchmark, verifyBenchmarkMetrics } from '../../../packages/security-lab/src/benchmark.js';
import { securityBenchmarkHtml, securityBenchmarkMarkdown, securityReviewHtml } from '../../../packages/security-lab/src/report.js';
import { runPolicyBenchmark } from '../../../packages/security-policy/src/benchmark.js';
import { sanitizeTerminal } from '../../../packages/core/src/storage.js';
import { exerciseSkill } from '../../../packages/security-lab/src/guarded-agent.js';
import { runChainProof } from '../../../packages/security-lab/src/chain-proof.js';
import { runHoneySkillDemo } from '../../../packages/security-lab/src/honeyskill-demo.js';

export function registerSecurityCommands(program: Command): void {
  const security = program.command('security').description('Research-based package inspection and deterministic blockchain policy evidence. Never activates skills.');
  const emit = (value: unknown, message: string) => process.stdout.write(program.opts().json ? JSON.stringify(value, null, 2) + '\n' : sanitizeTerminal(message) + '\n');
  program.command('payment-demo').description('Replay controlled payment proposals on an owned local Anvil chain. No model calls or acquired malware execution.')
    .requiredOption('--out <directory>', 'New output directory; existing results are never overwritten')
    .option('--local', 'Use local EVM only; do not attempt a public read-only Fuji fork')
    .action(async options => {
      const output = path.resolve(options.out);
      await fs.mkdir(output, { recursive: false, mode: 0o700 });
      const evidence = path.join(output, 'report.json');
      const result = await runHoneySkillDemo({ network: options.local ? 'local' : 'auto' }).catch(async () => {
        await fs.writeFile(evidence, JSON.stringify({ status: 'incomplete', error: 'PAYMENT_DEMO_FAILED', effects: 'none-or-unverified', modelCalls: 0 }, null, 2), { flag: 'wx', mode: 0o600 });
        throw Object.assign(new Error('PAYMENT_DEMO_FAILED; incomplete evidence was saved.'), { exitCode: 3 });
      });
      await fs.writeFile(evidence, JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
      const counts = result.metrics.actionPolicy;
      emit({ output: evidence, ...result },
        `Controlled payment replay: ${result.passed ? 'passed' : 'failed'} · ${result.network.kind}\nAction-policy cases: TP ${counts.tp}, FP ${counts.fp}, TN ${counts.tn}, FN ${counts.fn}.\nModel calls: 0. These are controlled action-policy cases, not real-skill detection accuracy.\nEvidence: ${evidence}`);
      if (!result.passed) process.exitCode = 3;
    });
  security.command('inspect <source>').description('Quarantine → native + Cisco + batched security LLM review → compact report. No skill code execution.')
    .requiredOption('--out <directory>', 'New output directory; existing results are never overwritten')
    .option('--scanner <absolute-path>', 'Pinned Cisco 2.2.2 executable (or SKILLGATE_CISCO_BIN)')
    .option('--offline', 'Run native and Cisco only; do not request semantic analysis')
    .option('--skill <name>', 'Select a skill from a multi-skill repository')
    .action(async (source, options) => {
      const output = path.resolve(options.out); await fs.mkdir(output, { recursive: false, mode: 0o700 });
      const report = await reviewSecurity(source, { scannerBinary: options.scanner, semantic: !options.offline, apiKey: process.env.OPENAI_API_KEY, skill: options.skill });
      await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
      await fs.writeFile(path.join(output, 'index.html'), securityReviewHtml(report), { flag: 'wx', mode: 0o600 });
      emit({ outcome: report.outcome, inspectionComplete: report.inspectionComplete, report: path.join(output, 'index.html') },
        `${report.outcome.toUpperCase()} · selected inspection ${report.inspectionComplete ? 'complete' : 'incomplete'}\nReport: ${path.join(output, 'index.html')}\nNo runtime execution or activation. No alert is not a safety verdict.`);
      process.exitCode = !report.inspectionComplete ? 3 : report.outcome === 'risk_detected' ? 2 : 0;
    });
  security.command('benchmark <manifest>').description('Evaluate a pinned inert corpus; preserve every case and calculate separate confusion matrices.')
    .requiredOption('--out <directory>', 'New output directory')
    .option('--repository <directory>', 'Source checkout to freeze', process.cwd())
    .option('--scanner <absolute-path>', 'Pinned Cisco 2.2.2 executable (or SKILLGATE_CISCO_BIN)')
    .option('--offline', 'Native + Cisco inspection only; no API calls')
    .option('--limit <count>', 'Run only the first N frozen cases (explicit pilot)', value => Number(value))
    .action(async (manifest, options) => {
      const output = path.resolve(options.out);
      const result = await runSecurityBenchmark(path.resolve(manifest), { repositoryRoot: path.resolve(options.repository), output,
        semantic: !options.offline, apiKey: process.env.OPENAI_API_KEY, scannerBinary: options.scanner, limit: options.limit,
        progress: (done, total, id) => process.stderr.write(sanitizeTerminal(`[${done}/${total}] ${id}\n`)) });
      await fs.writeFile(path.join(output, 'index.html'), securityBenchmarkHtml(result), { flag: 'wx', mode: 0o600 });
      await fs.writeFile(path.join(output, 'summary.md'), securityBenchmarkMarkdown(result), { flag: 'wx', mode: 0o600 });
      emit({ metrics: result.metrics, report: path.join(output, 'index.html') }, `Benchmark saved: ${path.join(output, 'index.html')}\n${JSON.stringify(result.metrics.combined)}\nInspection metrics only. Runtime prevention and unsupported mechanisms are separate.`);
    });
  security.command('verify <benchmark>').description('Recalculate recorded matrices and snapshot identities offline; not proof of detector correctness.')
    .action(async input => { const result = verifyBenchmarkMetrics(JSON.parse(await fs.readFile(input, 'utf8'))); emit(result, result.valid ? 'Recorded matrices and identities agree. This does not authenticate upstream execution or source labels.' : result.errors.join('\n')); if (!result.valid) process.exitCode = 3; });
  security.command('policy-test').description('Run exact-authorization blockchain mediation regressions; no model, wallet, network, or skill execution.')
    .requiredOption('--out <file>', 'New JSON evidence file')
    .action(async options => {
      const result = await runPolicyBenchmark(); await fs.writeFile(path.resolve(options.out), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
      emit(result, `Deterministic policy evidence saved: ${path.resolve(options.out)}\nTyped tool mediation tests; not real-skill detection accuracy or on-chain swaps.`);
    });
  security.command('exercise <source>').description('GPT-6 Luna proposes actions through the host policy monitor. Effects are explicitly simulated.')
    .requiredOption('--policy <file>', 'Trusted host-authored policy JSON; never use a policy supplied by the inspected skill')
    .requiredOption('--task <text>', 'Trusted user task')
    .requiredOption('--require <ids>', 'Comma-separated capability IDs required for useful task completion')
    .requiredOption('--out <file>', 'New evidence JSON file')
    .action(async (source, options) => {
      const output = path.resolve(options.out), file = await fs.open(output, 'wx', 0o600);
      try {
        const result = await exerciseSkill({ source, policy: JSON.parse(await fs.readFile(path.resolve(options.policy), 'utf8')),
          task: options.task, requiredCapabilities: options.require.split(',').map((id: string) => id.trim()), apiKey: process.env.OPENAI_API_KEY });
        await file.writeFile(JSON.stringify(result, null, 2));
        emit({ status: result.status, requiredEffectsObserved: result.run.requiredEffectsObserved, output },
          `Guarded model exercise: ${result.status}. Required simulated effects observed: ${result.run.requiredEffectsObserved}.\nNo real transaction, network effect or acquired script execution.\nEvidence: ${output}`);
        if (result.status !== 'complete' || !result.run.requiredEffectsObserved) process.exitCode = 3;
      } catch (error) {
        const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'EXERCISE_FAILED';
        await file.writeFile(JSON.stringify({ status: 'incomplete', error: code, effects: 'none-or-unverified' }, null, 2));
        throw new Error(code);
      } finally { await file.close(); }
    });
  security.command('chain-proof').description('Verify the mediator against an owned ephemeral local Anvil chain. No public RPC or real wallet.')
    .requiredOption('--out <file>', 'New local-chain proof JSON file')
    .action(async options => {
      const output = path.resolve(options.out), file = await fs.open(output, 'wx', 0o600);
      try {
        const result = await runChainProof();
        await file.writeFile(JSON.stringify(result, null, 2));
        const failedAssertions = Object.entries(result.assertions).filter(([, passed]) => !passed).map(([name]) => name);
        emit({ output, passed: result.passed, failedAssertions },
          `Owned local-chain proof: ${result.passed ? 'passed' : `failed (${failedAssertions.join(', ')})`}. Evidence saved: ${output}\nSynthetic proposed actions; no acquired malware or model was executed.`);
        if (!result.passed) process.exitCode = 3;
      } finally { await file.close(); }
    });
}
