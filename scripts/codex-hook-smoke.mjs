import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const cli = path.join(repository, 'dist/cli.js');
const output = path.join(repository, 'outputs');
const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'honeyskill-codex-hook-smoke-')));
const project = path.join(temporary, 'project');
const isolatedHome = path.join(temporary, 'home');
const isolatedCodex = path.join(isolatedHome, '.codex');
const fakeBin = path.join(temporary, 'upstream-bin');
const sentinel = path.join(project, 'upstream-was-executed.txt');
const requests = [];
let server, log = '', failure;
const evidence = {
  schemaVersion: 1, executedAt: new Date().toISOString(), command: 'node scripts/codex-hook-smoke.mjs',
  status: 'running', provider: 'deterministic Responses SSE mock on loopback', realModelExecution: false,
  paidProviderCalls: 0, realSecretsUsed: false, realFunds: false,
  isolation: { temporary, project, codexHome: isolatedCodex, home: isolatedHome, removedAfterRun: false },
  hookTrust: 'Explicit --dangerously-bypass-hook-trust for this invocation only; authored hook in an isolated temporary project; no persistent trust change.',
  projectTrust: 'Only the temporary project is trusted in the temporary CODEX_HOME/config.toml; the real user configuration is neither loaded nor changed.',
  documentation: 'https://learn.chatgpt.com/docs/hooks',
  sandbox: 'danger-full-access for this isolated mock invocation only, so the authored installer may write the temporary .agents directory; no normal product sandbox override.',
  limitations: ['Mock emits prescribed tool calls; this does not measure model behaviour.', 'Checks the installed Codex CLI version only.', 'Codex workspace-write protects .agents; installation requires the host to authorize those filesystem writes.', 'Codex owns hook trust and runtime failure policy; this is not universal installation interception.'],
};
const quote = value => `'${value.replace(/'/g, `'\\''`)}'`;
try {
  await Promise.all([mkdir(project, { recursive: true }), mkdir(isolatedCodex, { recursive: true }), mkdir(fakeBin)]);
  execFileSync('git', ['init', '--quiet', project]);
  evidence.codexVersion = execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim();
  evidence.nodeVersion = process.version;
  evidence.cliSha256 = createHash('sha256').update(await readFile(cli)).digest('hex');
  for (const [fixture, name] of [['portfolio-legitimate', 'portfolio-summary'], ['portfolio-suspicious', 'portfolio-summary-trap']]) {
    const destination = path.join(temporary, 'sources', name);
    await mkdir(destination, { recursive: true });
    const text = await readFile(path.join(repository, 'fixtures', fixture, 'SKILL.md.fixture'), 'utf8');
    await writeFile(path.join(destination, 'SKILL.md'), text.replace(/^name: portfolio-summary$/m, `name: ${name}`));
    await writeFile(path.join(destination, 'actions.json'), await readFile(path.join(repository, 'fixtures', fixture, 'actions.json')));
  }
  await writeFile(path.join(fakeBin, 'npx'), `#!/bin/sh\nprintf '%s\\n' 'FAKE upstream installer was executed' >> ${quote(sentinel)}\nexit 0\n`, { mode: 0o700 });
  await chmod(path.join(fakeBin, 'npx'), 0o700);
  const setup = execFileSync(process.execPath, [cli, '--project', project, 'enable', '--codex-hook', '--json'], { encoding: 'utf8' });
  evidence.setup = JSON.parse(setup);
  evidence.hooksConfig = JSON.parse(await readFile(path.join(project, '.codex/hooks.json'), 'utf8'));
  await writeFile(path.join(isolatedCodex, 'config.toml'), `[projects.${JSON.stringify(project)}]\ntrust_level = "trusted"\n`);
  const commands = ['portfolio-summary', 'portfolio-summary-trap'].map(name => `npx skills add ${quote(path.join(temporary, 'sources', name))} --agent codex -y`);
  evidence.mockRequestedCommands = commands;
  let turn = 0;
  server = createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/v1/responses');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.authorization, undefined, 'Mock provider must receive no API credential');
      let body = '';
      for await (const chunk of request) { body += chunk; assert.ok(body.length < 2_000_000); }
      const input = JSON.parse(body);
      assert.ok(input.tools.some(tool => tool.type === 'function' && tool.name === 'exec_command'));
      const outputs = (input.input ?? []).filter(item => item.type === 'function_call_output').map(item => ({ callId: item.call_id, output: String(item.output).slice(0, 20000) }));
      requests.push({ method: request.method, path: request.url, model: input.model, authentication: 'none', toolNames: input.tools.map(tool => tool.name).filter(Boolean), outputs });
      turn++;
      assert.ok(turn <= 3, 'Unexpected extra model request');
      const item = turn <= commands.length
        ? { type: 'function_call', id: `fc_${turn}`, call_id: `call_${turn}`, name: 'exec_command', arguments: JSON.stringify({ cmd: commands[turn - 1], workdir: project, login: false, yield_time_ms: 1000, max_output_tokens: 6000 }), status: 'completed' }
        : { type: 'message', id: 'msg_done', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'MOCK provider finished the prescribed local test.', annotations: [] }] };
      const result = { id: `resp_${turn}`, object: 'response', created_at: Math.floor(Date.now() / 1000), status: 'completed', model: input.model, output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (type, values) => response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...values })}\n\n`);
      send('response.created', { response: { ...result, status: 'in_progress', output: [] } });
      send('response.output_item.added', { output_index: 0, item });
      send('response.output_item.done', { output_index: 0, item });
      send('response.completed', { response: result });
      response.end();
    } catch (error) {
      failure = error;
      response.writeHead(500, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
  evidence.providerBaseUrl = baseUrl;
  const args = ['exec', '--ephemeral', '--ignore-rules', '--skip-git-repo-check', '--dangerously-bypass-hook-trust', '-C', project, '--sandbox', 'danger-full-access', '--json', '--color', 'never', '-m', 'mock-honeyskill',
    '-c', 'features.hooks=true', '-c', `projects.${JSON.stringify(project)}.trust_level="trusted"`, '-c', 'model_provider="mock"',
    '-c', `model_providers.mock={name="Local deterministic mock",base_url="${baseUrl}",wire_api="responses",requires_openai_auth=false}`,
    'Run the two prescribed local skill installation commands. These are isolated synthetic fixtures and the provider is a deterministic local mock.'];
  evidence.codexArguments = args;
  const child = spawn('codex', args, {
    cwd: project, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`, HOME: isolatedHome, CODEX_HOME: isolatedCodex, ZDOTDIR: isolatedHome, NO_COLOR: '1' },
  });
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const timeout = setTimeout(() => { failure = new Error('Codex mock smoke timed out after 40 seconds'); child.kill('SIGTERM'); }, 40000);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  clearTimeout(timeout);
  evidence.codexExit = result;
  evidence.mockRequests = requests;
  if (failure) throw failure;
  assert.equal(result.code, 0, 'Codex process must complete');
  assert.equal(requests.length, 3, 'Two actual shell-tool calls and final mock completion');
  const toolExecutions = log.split('\n').flatMap(line => {
    try {
      const event = JSON.parse(line);
      return event.type === 'item.completed' && event.item?.type === 'command_execution'
        ? [{ command: event.item.command, exitCode: event.item.exit_code }] : [];
    } catch { return []; }
  });
  evidence.toolExecutions = toolExecutions;
  assert.equal(toolExecutions.length, 2);
  assert.deepEqual(toolExecutions.map(item => item.exitCode), [0, 2]);
  for (const execution of toolExecutions) {
    assert.ok(execution.command.includes(cli) && execution.command.includes("'install'"), 'Codex must execute the rewritten HoneySkill command');
    assert.ok(!execution.command.includes('npx skills add'), 'Original installer invocation must be replaced');
  }
  const upstreamRan = await readFile(sentinel, 'utf8').then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  evidence.upstreamInstallerExecuted = upstreamRan;
  assert.equal(upstreamRan, false, 'Original npx installer must never execute');
  const reportDirectory = path.join(project, '.skillgate/reports');
  const reports = await Promise.all((await readdir(reportDirectory)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(path.join(reportDirectory, name), 'utf8'))));
  evidence.reports = reports;
  const legitimate = reports.find(report => report.name === 'portfolio-summary');
  const trap = reports.find(report => report.name === 'portfolio-summary-trap');
  assert.equal(legitimate?.decision, 'allow');
  assert.equal(trap?.decision, 'hold');
  const activeSkills = await readdir(path.join(project, '.agents/skills'));
  evidence.activeSkills = activeSkills;
  assert.deepEqual(activeSkills, ['portfolio-summary']);
  const record = JSON.parse(await readFile(path.join(project, '.skillgate/installs/portfolio-summary.json'), 'utf8'));
  assert.equal(record.status, 'installed');
  assert.equal(record.fingerprint, legitimate.fingerprint);
  evidence.legitimateInstallation = record;
  evidence.status = 'passed';
} catch (error) {
  failure = error;
  evidence.status = 'failed';
  evidence.error = error.stack ?? String(error);
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  evidence.mockRequests ??= requests;
  await rm(temporary, { recursive: true, force: true });
  evidence.isolation.removedAfterRun = true;
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'codex-hook-smoke.json'), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(path.join(output, 'codex-hook-smoke.log'), log);
}
console.log(JSON.stringify({ status: evidence.status, codexVersion: evidence.codexVersion, provider: evidence.provider, upstreamInstallerExecuted: evidence.upstreamInstallerExecuted, activeSkills: evidence.activeSkills, error: failure?.message }, null, 2));
if (failure) process.exitCode = 1;
