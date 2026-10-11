import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile, access, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareCodexHook, processHook, pinCliRuntime, codexHookStatus } from '../apps/cli/src/codex-hook.js';

const root = '/tmp/skillgate-hook-project';
const cli = join(await mkdtemp(join(tmpdir(), 'honeyskill-hook-cli-')), 'cli.js');
await writeFile(cli, '// Authored unit-test runtime.\n');
const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
const event = (command: string) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd: root, tool_input: { command } });
const run = (command: string) => processHook(event(command), root, cli, process.execPath)?.hookSpecificOutput;

test('Codex hook configuration preserves other hooks and is idempotent', async () => {
  const project = await mkdtemp(join(tmpdir(), 'skillgate-hooks-'));
  await mkdir(join(project, '.codex'));
  const existing = { description: 'Existing configuration', hooks: {
    Stop: [{ hooks: [{ type: 'command', command: 'existing-stop' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'existing-check' }] }],
  } };
  const file = join(project, '.codex', 'hooks.json');
  await writeFile(file, JSON.stringify(existing));
  const first = await prepareCodexHook(project, cli, process.execPath);
  assert.equal(first.changed, true); assert.equal(first.requiresTrust, true); assert.equal(first.reviewCommand, '/hooks');
  assert.equal(first.failOpenOnHookRuntimeError, true);
  const bytes = await readFile(file, 'utf8'); const result = JSON.parse(bytes);
  assert.equal(result.description, existing.description);
  assert.deepEqual(result.hooks.Stop, existing.hooks.Stop);
  assert.deepEqual(result.hooks.PreToolUse[0], existing.hooks.PreToolUse[0]);
  assert.deepEqual(Object.keys(result.hooks.PreToolUse[1]).sort(), ['hooks', 'matcher']);
  assert.equal(result.hooks.PreToolUse[1].matcher, '^Bash$');
  const handler = result.hooks.PreToolUse[1].hooks[0];
  assert.equal(handler.type, 'command'); assert.equal(handler.timeout, 10);
  assert.ok(handler.command.includes(cli));
  assert.equal(first.persistent, true);
  assert.equal(first.runtimeFailureDecision, 'deny');
  assert.equal((await codexHookStatus(project)).configured, true);
  assert.equal((await prepareCodexHook(project, cli, process.execPath)).changed, false);
  assert.equal(await readFile(file, 'utf8'), bytes);
  const newCli = join(project, 'new CLI.js'); await writeFile(newCli, '// Updated authored runtime.\n');
  await prepareCodexHook(project, newCli, process.execPath);
  const changed = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(changed.hooks.PreToolUse.length, 2);
  assert.match(changed.hooks.PreToolUse[1].hooks[0].command, /new CLI/);
});

test('Codex hook setup refuses malformed or symlinked existing configuration', async () => {
  const project = await mkdtemp(join(tmpdir(), 'skillgate-hooks-invalid-'));
  await mkdir(join(project, '.codex')); const file = join(project, '.codex', 'hooks.json');
  const invalid = '{"hooks":{"PreToolUse":"not-an-array"}}';
  await writeFile(file, invalid);
  await assert.rejects(prepareCodexHook(project, cli, process.execPath), /Invalid PreToolUse/);
  assert.equal(await readFile(file, 'utf8'), invalid);
  const linked = await mkdtemp(join(tmpdir(), 'skillgate-hooks-linked-'));
  const valid = '{"hooks":{}}';
  await writeFile(file, valid);
  await symlink(join(project, '.codex'), join(linked, '.codex'));
  await assert.rejects(prepareCodexHook(linked, cli, process.execPath));
  assert.equal(await readFile(file, 'utf8'), valid);
});

test('Codex hook refresh replaces its previous display label without registering twice', async () => {
  const project = await mkdtemp(join(tmpdir(), 'skillgate-hooks-language-'));
  await mkdir(join(project, '.codex'));
  const file = join(project, '.codex/hooks.json');
  await writeFile(file, JSON.stringify({ hooks: { PreToolUse: [{ matcher: '^Bash$', hooks: [{ type: 'command', command: 'previous-skillgate-hook', statusMessage: 'SkillGate : contrôle avant installation' }] }] } }));
  await prepareCodexHook(project, cli, process.execPath);
  const result = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(result.hooks.PreToolUse.length, 1);
  assert.equal(result.hooks.PreToolUse[0].hooks[0].statusMessage, 'HoneySkill: pre-install check');
  await writeFile(file, JSON.stringify({ hooks: { PreToolUse: [{ matcher: '^Bash$', hooks: [{ type: 'command', command: 'previous-skillgate-hook', statusMessage: 'SkillGate: pre-install check' }] }] } }));
  await prepareCodexHook(project, cli, process.execPath);
  const english = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(english.hooks.PreToolUse.length, 1);
  assert.equal(english.hooks.PreToolUse[0].hooks[0].statusMessage, 'HoneySkill: pre-install check');
  assert.equal((await prepareCodexHook(project, cli, process.execPath)).changed, false);
});

test('ordinary commands and events stay unchanged', () => {
  for (const command of ['pwd', 'git status --short', 'echo "npx skills add"', 'pnpm test', 'npx prettier --check .']) assert.equal(run(command), undefined, command);
  assert.equal(processHook({ ...event('npx skills add owner/repo'), tool_name: 'Read' }, root, cli, process.execPath), undefined);
  assert.equal(processHook({ ...event('npx skills add owner/repo'), hook_event_name: 'PostToolUse' }, root, cli, process.execPath), undefined);
  assert.equal(processHook({ ...event(''), tool_input: {} }, root, cli, process.execPath)?.hookSpecificOutput.permissionDecision, 'deny');
});

test('supported terminal installers rewrite to the guarded installer before execution', () => {
  for (const command of ['npx skills add owner/repo --skill portfolio', 'pnpm dlx skills add owner/repo --skill portfolio', 'skills add owner/repo --skill portfolio']) {
    const output = run(command)!;
    assert.equal(output.permissionDecision, 'allow', command);
    assert.match(output.updatedInput!.command, /'install' '--skill' 'portfolio' '--' 'https:\/\/github.com\/owner\/repo'/);
    assert.match(output.additionalContext!, /before activation/);
    assert.doesNotMatch(output.updatedInput!.command, /'npx'|'pnpm'|'skills'/);
  }
});

test('native Codex installer requires a single skill and the explicit project destination', () => {
  const base = 'python3 /opt/codex/skill-installer/scripts/install-skill-from-github.py';
  const target = ` --dest ${root}/.agents/skills`;
  const output = run(`${base} --repo openai/skills --path skills/portfolio --ref abc123${target}`)!;
  assert.equal(output.permissionDecision, 'allow');
  assert.match(output.updatedInput!.command, /https:\/\/github.com\/openai\/skills\/tree\/abc123\/skills\/portfolio/);
  const url = run(`${base} --url https://github.com/openai/skills/tree/main/skills/portfolio${target}`)!;
  assert.equal(url.permissionDecision, 'allow');
  for (const command of [
    `${base} --repo openai/skills --path skills/portfolio`,
    `${base} --repo openai/skills --path skills/portfolio --dest /tmp/elsewhere`,
    `${base} --repo openai/skills --path skills/one skills/two${target}`,
    `${base} --repo openai/skills --path skills/portfolio --name other${target}`,
    `${base} --repo openai/skills --path skills/portfolio --method git${target}`,
    `${base} --repo openai/skills --path ../escape${target}`,
    `${base} --repo openai/skills --path skills/portfolio --ref branch/ambiguous${target}`,
    `${base} --repo openai/skills --path skills/one --path skills/two${target}`,
    `${base} --url https://user:password@github.com/openai/skills/tree/main/skills/portfolio${target}`,
  ]) assert.equal(run(command)!.permissionDecision, 'deny', command);
});

test('known installers with ambiguous shell syntax or unsupported targets are denied', () => {
  for (const command of [
    'npx skills add owner/repo && echo installed',
    'cd /tmp && npx skills add owner/repo',
    'npx skills add $(echo owner/repo)',
    'npx skills add "${SOURCE}"',
    'npx skills add owner/repo; touch /tmp/marker',
    'npx skills add owner/repo\necho installed',
    'npx skills add owner/repo --global',
    'skills add owner/repo --agent claude-code',
    'skills update',
    'python3 -u /opt/install-skill-from-github.py --repo openai/skills',
    '"npx" "skills" add owner/repo && echo installed',
    "'pnpm' 'dlx' 'skills' add owner/repo; echo installed",
    'env npx skills add owner/repo',
    'command npx skills add owner/repo',
    'builtin npx skills add owner/repo',
    'skills check && echo updated',
    'skills find portfolio && echo installed',
    '"skills" "i" owner/repo && echo installed',
  ]) {
    const output = run(command)!;
    assert.equal(output.permissionDecision, 'deny', command);
    assert.equal(output.updatedInput, undefined);
  }
});

test('recognized installs cannot silently change project or explicit command working directory', () => {
  const input = event('npx skills add owner/repo');
  for (const overridden of [
    { ...input, cwd: '/tmp/other-project' },
    { ...input, cwd: undefined },
    { ...input, tool_input: { ...input.tool_input, workdir: '/tmp/other-project' } },
    { ...input, tool_input: { ...input.tool_input, cwd: '/tmp/other-project' } },
  ]) assert.equal(processHook(overridden, root, cli, process.execPath)?.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(processHook(input, root, '/tmp/invalid\ncli.js', process.execPath)?.hookSpecificOutput.permissionDecision, 'deny');
});

test('project hooks also protect commands run from project subdirectories', async () => {
  const project = await mkdtemp(join(tmpdir(), 'honeyskill-hook-subdirectory-'));
  await mkdir(join(project, 'src'));
  const input = { ...event('npx skills add owner/repo'), cwd: project, tool_input: { command: 'npx skills add owner/repo', workdir: join(project, 'src') } };
  assert.equal(processHook(input, project, cli, process.execPath)?.hookSpecificOutput.permissionDecision, 'allow');
  input.tool_input.workdir = project + '-outside';
  assert.equal(processHook(input, project, cli, process.execPath)?.hookSpecificOutput.permissionDecision, 'deny');
});

test('pinned runtime survives global removal; missing, changed and failing runtimes deny', async () => {
  for (const scenario of ['removed-global', 'missing-pinned', 'changed', 'crash', 'invalid-output', 'missing-node', 'timeout']) {
    const project = await mkdtemp(join(tmpdir(), 'honeyskill-hook-runtime-'));
    const source = join(project, 'global.js');
    const output = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Authored valid unit response' } };
    await writeFile(source, scenario === 'crash' ? 'process.exit(1);' : scenario === 'invalid-output' ? 'console.log("not JSON");' : scenario === 'timeout' ? 'setInterval(()=>{},1000);' : `console.log(${JSON.stringify(JSON.stringify(output))});`);
    const pinned = await pinCliRuntime(project, source);
    assert.equal(await pinCliRuntime(project, source), pinned);
    await prepareCodexHook(project, pinned, scenario === 'missing-node' ? '/missing/honeyskill-node' : process.execPath);
    await rm(source);
    if (scenario === 'missing-pinned') await rm(pinned);
    if (scenario === 'changed') await writeFile(pinned, 'process.exit(0);');
    const config = JSON.parse(await readFile(join(project, '.codex/hooks.json'), 'utf8'));
    const result = spawnSync('/bin/sh', ['-c', config.hooks.PreToolUse[0].hooks[0].command], { input: JSON.stringify(event('npx skills add owner/repo')), encoding: 'utf8', timeout: 8000 });
    assert.equal(result.status, 0, `${scenario}: ${result.stderr}`);
    const decision = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(decision.permissionDecision, 'deny', scenario);
    assert.match(decision.permissionDecisionReason, scenario === 'removed-global' ? /Authored valid/ : /unavailable or its runtime changed/, scenario);
  }
});

test('hook rewrites preserve literal argv without shell injection in project, CLI or source paths', async () => {
  const project = await mkdtemp(join(tmpdir(), "skillgate hook '$-"));
  const mockCli = join(project, "mock cli's.mjs"); const marker = join(project, 'injected');
  await writeFile(mockCli, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
  const maliciousFolder = `skills/a'$(touch ${marker})`;
  const command = ['python3', '/opt/install-skill-from-github.py', '--repo', 'owner/repo', '--path', maliciousFolder, '--dest', join(project, '.agents', 'skills')].map(quote).join(' ');
  const output = processHook({ ...event(command), cwd: project }, project, mockCli, process.execPath)!.hookSpecificOutput;
  assert.equal(output.permissionDecision, 'allow');
  const result = spawnSync('/bin/sh', ['-c', output.updatedInput!.command], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['--project', project, 'install', '--', `https://github.com/owner/repo/tree/main/${maliciousFolder.split('/').map(encodeURIComponent).join('/')}`]);
  await assert.rejects(access(marker));
});
