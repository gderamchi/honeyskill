import { basename, isAbsolute, join, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { atomicJson, exists, readJson } from '../../../packages/core/src/storage.js';
import { parseInstallerArgv } from './terminal.js';

const statusMessage = 'SkillGate : contrôle avant installation';
const nativeInstaller = 'install-skill-from-github.py';
type JsonObject = Record<string, unknown>;
export type HookResult = { hookSpecificOutput: {
  hookEventName: 'PreToolUse'; permissionDecision: 'allow' | 'deny';
  permissionDecisionReason?: string; additionalContext?: string;
  updatedInput?: { command: string };
} };
const object = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
const commandLine = (argv: string[]): string => argv.map(quote).join(' ');

/** Only a literal argv is supported: no shell expressions are evaluated. */
function shellArgv(command: string): string[] {
  if (/[\x00-\x1f\x7f]/.test(command)) throw new Error('Commandes multilignes ou caractères de contrôle non pris en charge.');
  const args: string[] = []; let token = '', active = false, quoted: "'" | '"' | undefined;
  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;
    if (quoted === "'") {
      if (char === "'") quoted = undefined; else token += char;
      continue;
    }
    if (char === '\\') {
      const next = command[++i];
      if (next === undefined) throw new Error('Échappement shell incomplet.');
      if (quoted === '"' && !['"', '\\', '$', '`'].includes(next)) token += '\\';
      token += next; active = true; continue;
    }
    if (quoted === '"') {
      if (char === '"') quoted = undefined;
      else if (char === '$' || char === '`') throw new Error('Substitutions shell non prises en charge.');
      else token += char;
      continue;
    }
    if (char === "'" || char === '"') { quoted = char; active = true; continue; }
    if (char === ' ') { if (active) { args.push(token); token = ''; active = false; } continue; }
    if (/[;&|()<>$`*?\[\]{}~#]/.test(char)) throw new Error('Expressions ou commandes shell composées non prises en charge.');
    token += char; active = true;
  }
  if (quoted) throw new Error('Guillemet shell incomplet.');
  if (active) args.push(token);
  return args;
}

function relevant(command: string): boolean {
  const normalized = command.replace(/['"\\]/g, '');
  return command.includes(nativeInstaller) || /\b(?:npx\s+(?:[^\n;&|]*\s)?skills(?:@[^\s]+)?|pnpm\s+dlx\s+(?:[^\n;&|]*\s)?skills(?:@[^\s]+)?|skills\s+\S)/.test(normalized);
}
const validAbsolute = (value: unknown): value is string => typeof value === 'string' && isAbsolute(value) && !/[\x00-\x1f\x7f]/.test(value);
function canonical(path: string): string { try { return realpathSync(path); } catch { return resolve(path); } }
function denied(reason: string): HookResult {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `SkillGate : ${reason} Utilisez skillgate install <source> dans le projet protégé.` } };
}
function nativeSource(args: string[], root: string): string {
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!, value = args[i + 1];
    if (!['--repo', '--url', '--path', '--ref', '--dest'].includes(key) || options.has(key) || !value || value.startsWith('--')) {
      throw new Error('Installateur Codex : une seule source et un seul --path sont pris en charge ; options inconnues refusées.');
    }
    options.set(key, value);
  }
  if (options.get('--dest') !== join(resolve(root), '.agents', 'skills')) throw new Error('Installateur Codex : --dest doit désigner explicitement le dossier .agents/skills absolu de ce projet. La destination globale implicite est refusée.');
  if (options.has('--repo') === options.has('--url')) throw new Error('Installateur Codex : fournissez exactement --repo ou --url.');
  let repo = options.get('--repo'), reference = options.get('--ref') ?? 'main', folder = options.get('--path');
  if (options.has('--url')) {
    const url = new URL(options.get('--url')!);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Seules les URL publiques HTTPS GitHub sont prises en charge.');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    repo = parts.slice(0, 2).join('/');
    if (parts.length > 2) {
      if (parts[2] !== 'tree' || !parts[3]) throw new Error('Utilisez une URL GitHub /tree/révision/dossier.');
      reference = parts[3]; folder ??= parts.slice(4).join('/');
    }
  }
  if (!repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.split('/').some(x => ['.', '..'].includes(x))) throw new Error('Dépôt GitHub invalide.');
  if (!/^[A-Za-z0-9_.-]+$/.test(reference) || ['.', '..'].includes(reference)) throw new Error('Révision simple ou SHA requis.');
  if (!folder || folder.startsWith('/') || folder.includes('\\') || folder.split('/').some(x => !x || x === '.' || x === '..')) throw new Error('Un unique dossier relatif de skill est requis.');
  return `https://github.com/${repo}/tree/${encodeURIComponent(reference)}/${folder.split('/').map(encodeURIComponent).join('/')}`;
}

export function processHook(input: unknown, root: string, cliPath: string, nodePath: string): HookResult | undefined {
  try {
    if (!object(input) || input.hook_event_name !== 'PreToolUse' || input.tool_name !== 'Bash') return undefined;
    if (!object(input.tool_input) || typeof input.tool_input.command !== 'string') return denied('Entrée du hook Bash invalide.');
    const command = input.tool_input.command;
    let argv: string[];
    try { argv = shellArgv(command); } catch (error) {
      if (!relevant(command)) return undefined;
      throw error;
    }
    if (!argv.length) return undefined;
    let source: string | undefined, skill: string | undefined;
    const executable = basename(argv[0]!);
    if (argv.some(x => basename(x) === nativeInstaller)) {
      const index = executable === nativeInstaller ? 0 : /^python(?:3(?:\.\d+)?)?$/.test(executable) && basename(argv[1] ?? '') === nativeInstaller ? 1 : -1;
      if (index < 0) return denied('Invocation de l’installateur Codex non prise en charge.');
      source = nativeSource(argv.slice(index + 1), root);
    } else if (['npx', 'pnpm', 'skills'].includes(executable)) {
      const parsed = parseInstallerArgv(executable as 'npx' | 'pnpm' | 'skills', argv.slice(1));
      if (parsed.kind === 'delegate') return undefined;
      if (parsed.kind === 'reject') return denied(parsed.reason);
      source = parsed.source; skill = parsed.skill;
    } else return relevant(command) && !['echo', 'printf'].includes(executable) ? denied('Invocation indirecte de l’installateur non prise en charge.') : undefined;
    if (![root, cliPath, nodePath].every(validAbsolute)) return denied('Configuration du hook invalide : chemins absolus sans caractères de contrôle requis.');
    for (const cwd of [input.cwd, input.tool_input.workdir, input.tool_input.cwd]) {
      if (cwd === undefined) continue;
      if (!validAbsolute(cwd) || canonical(cwd) !== canonical(root)) return denied('Cette commande provient d’un autre dossier que le projet protégé.');
    }
    if (!validAbsolute(input.cwd)) return denied('Dossier de session absent ou invalide.');
    const args = [nodePath, cliPath, '--project', resolve(root), 'install'];
    if (skill) args.push('--skill', skill);
    args.push('--', source);
    return { hookSpecificOutput: {
      hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { command: commandLine(args) },
      additionalContext: 'SkillGate remplace cet installateur : analyse locale avant activation dans .agents/skills du projet. Un paquet retenu reste inactif ; présentez les risques à l’utilisateur et attendez son choix explicite avant une exception.',
    } };
  } catch (error) {
    return denied(error instanceof Error ? error.message : 'Impossible de valider cette installation.');
  }
}

export async function prepareCodexHook(root: string, cliPath: string, nodePath: string) {
  if (![root, cliPath, nodePath].every(validAbsolute)) throw new Error('Chemins absolus sans caractères de contrôle requis pour configurer le hook Codex.');
  const path = join(root, '.codex', 'hooks.json');
  const existing = await exists(path) ? await readJson(path) : {};
  if (!object(existing) || (existing.hooks !== undefined && !object(existing.hooks))) throw new Error('hooks.json invalide ; configuration existante préservée.');
  const hooks = existing.hooks as JsonObject | undefined ?? {};
  const previous = hooks.PreToolUse ?? [];
  if (!Array.isArray(previous)) throw new Error('PreToolUse invalide ; configuration existante préservée.');
  const groups = previous.flatMap((group: unknown) => {
    if (!object(group) || !Array.isArray(group.hooks)) return [group];
    const handlers = group.hooks.filter(handler => !object(handler) || handler.statusMessage !== statusMessage);
    return handlers.length === group.hooks.length ? [group] : handlers.length ? [{ ...group, hooks: handlers }] : [];
  });
  const command = commandLine([nodePath, cliPath, '--project', resolve(root), 'hook']);
  groups.push({ matcher: '^Bash$', hooks: [{ type: 'command', command, timeout: 10, statusMessage }] });
  const config = { ...existing, hooks: { ...hooks, PreToolUse: groups } };
  const changed = JSON.stringify(config) !== JSON.stringify(existing);
  if (changed) await atomicJson(path, config);
  // shortcut: Codex owns trust state and may fail open before this process starts; report setup only.
  return { path, changed, requiresTrust: true, reviewCommand: '/hooks', scope: 'supported-codex-shell-installers', failOpenOnHookRuntimeError: true };
}
