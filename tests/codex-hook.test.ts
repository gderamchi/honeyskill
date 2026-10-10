import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareCodexHook, processHook } from '../apps/cli/src/codex-hook.js';

const root = '/tmp/skillgate-hook-project';
const cli = '/opt/skillgate/cli.js';
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
  assert.match(handler.command, /'--project'.*'hook'$/);
  assert.equal((await prepareCodexHook(project, cli, process.execPath)).changed, false);
  assert.equal(await readFile(file, 'utf8'), bytes);
  await prepareCodexHook(project, '/opt/new CLI/cli.js', process.execPath);
  const changed = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(changed.hooks.PreToolUse.length, 2);
  assert.match(changed.hooks.PreToolUse[1].hooks[0].command, /new CLI/);
});

test('Codex hook setup refuses malformed or symlinked existing configuration', async () => {
  const project = await mkdtemp(join(tmpdir(), 'skillgate-hooks-invalid-'));
  await mkdir(join(project, '.codex')); const file = join(project, '.codex', 'hooks.json');
  const invalid = '{"hooks":{"PreToolUse":"not-an-array"}}';
  await writeFile(file, invalid);
  await assert.rejects(prepareCodexHook(project, cli, process.execPath), /PreToolUse invalide/);
  assert.equal(await readFile(file, 'utf8'), invalid);
  const linked = await mkdtemp(join(tmpdir(), 'skillgate-hooks-linked-'));
  const valid = '{"hooks":{}}';
  await writeFile(file, valid);
  await symlink(join(project, '.codex'), join(linked, '.codex'));
  await assert.rejects(prepareCodexHook(linked, cli, process.execPath));
  assert.equal(await readFile(file, 'utf8'), valid);
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
    assert.match(output.additionalContext!, /avant activation/);
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
