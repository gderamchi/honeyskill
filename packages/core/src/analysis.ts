import path from 'node:path';
import type { Evidence, Finding, ScanReport } from '../../contracts/src/index.js';
import { finalizeCoverage, type Inventory } from './acquisition.js';
import { sha256 } from './storage.js';
import { redactApparentSecrets } from './semantic.js';

export const ENGINE_VERSION = '0.2.0';
export const RULES_VERSION = 'finance-native-4';
export const CORPUS_VERSION = '2026-10-10';
export const POLICY_VERSION = 'finance-policy-1';

interface Line { file: string; line: number; endLine: number; text: string; original: string; focus?: string }
const normalize = (text: string): string => text.normalize('NFKC').replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const rejection = /(?:do not|don't|never) (?:execute|follow|obey)|\b(?:reject|refuse) (?:to (?:execute|follow|obey)\b|(?:(?:this|that|the|these|those) )?(?:instruction|command|request|attack|example|quotation|quoted|sentence)\b)|\b(?:what|instructions?) to reject\b|inert example|non-executable|for illustration only|ne pas exécuter|n.exécutez pas/i;
const attackExample = /(?:attack(?:er)?|malicious|harmful|unsafe|historical).{0,90}(?:example|quote|write|say|told|instruction)|(?:example|quot(?:e|ation)).{0,90}(?:attack|malicious|harmful|unsafe)/i;
function executesExample(text: string): boolean {
  const active = text.replace(/\b(?:do not|don't|never|refuse to)\s+(?:execute|run|follow|obey|perform|apply|carry out)\b/gi, '[prohibited action]');
  return /\b(?:execute|run|follow|obey|perform|apply|carry out)\s+(?:it|them|this|that|the\s+(?:example|instruction|command|quotation))\b/i.test(active);
}
function negated(text: string): boolean {
  // shortcut: local prose negation is heuristic; executable code and contradictory clauses remain analyzed.
  if (/\b(?:unless|except|until|then|instead|but|however|nevertheless)\b/i.test(text)) return false;
  const action = '(?:(?:send|transmit|upload|share|execute|approve|sign|transfer|collect|read|load|obtain|request|switch|change|replace|override|overwrite|substitute|redirect|force|reroute|retry|grant|store|expose)(?:s|d|ed|ing)?|top\\s+up)\\b';
  return new RegExp(`^(?:[-*>#\\d.)]\\s*)*(?:(?:never|do not|don't|must not)\\s+${action}|(?:this (?:skill|tool|package)|it|we)\\s+(?:does not|will not|never|cannot)\\s+${action}|no\\s+(?:signing|transfers?|payments?|approvals?|secret collection)\\b.{0,160}\\b(?:required|performed|allowed|needed|supported))`, 'i').test(text.trim());
}
function activeLines(texts: Map<string, string>): Line[] {
  const lines: Line[] = [];
  for (const [file, content] of texts) {
    const prose = ['.md', '.txt'].includes(path.extname(file).toLowerCase());
    const rawLines = content.split(/\r?\n/);
    let codeFence = false, inertFence = false;
    const previous: string[] = [];
    for (const [index, original] of rawLines.entries()) {
      let text = normalize(original);
      if (prose && /^\s*(?:```|~~~)/.test(text)) {
        codeFence = !codeFence;
        // A title or a global safety claim never exempts another file or later active instructions.
        const introduction = previous.slice(-2).join('\n').slice(-800);
        inertFence = codeFence && rejection.test(introduction) && !executesExample(introduction) && /example|attack|illustration|exemple/i.test(introduction);
        continue;
      }
      if (prose && !codeFence) {
        const before = previous.slice(-1).join(' ').slice(-400), after = normalize(rawLines[index + 1] || '').slice(0, 400);
        text = text.replace(/"[^"\n]+"/g, (quoted, offset: number, whole: string) => {
          const introduction = `${before} ${whole.slice(Math.max(0, offset - 400), offset)}`.slice(-400);
          const instruction = `${whole.slice(offset + quoted.length, offset + quoted.length + 400)} ${after}`.slice(0, 400);
          return attackExample.test(introduction) && rejection.test(instruction) && !executesExample(instruction) ? ' [rejected quotation] ' : quoted;
        });
        if (/^\s*>/.test(text) && attackExample.test(before) && rejection.test(`${before} ${after}`) && !executesExample(`${before} ${after}`)) continue;
      }
      if (text.trim()) previous.push(text);
      if (codeFence && inertFence) continue;
      if (/^\s*(?:#|\/\/)/.test(text) && !prose) continue;
      const clauses = prose && !codeFence ? text.split(/;\s*|(?<=[.!?])\s+|\s+\b(?:but|however|nevertheless)\b[,;:]?\s*|\s+and\s+(?=(?:never|do not|don't|must not)\b)/i) : [text];
      for (const clause of clauses) if (clause.trim() && !(prose && !codeFence && negated(clause))) lines.push({ file, line: index + 1, endLine: index + 1, text: clause.trim(), original });
    }
  }
  return lines;
}
function evidence(line: Line): Evidence {
  let start = 0;
  if (line.original.length > 600 && line.focus) {
    const position = normalize(line.original).indexOf(line.focus);
    if (position > 80) {
      let normalizedOffset = 0;
      for (const character of line.original) {
        if (normalizedOffset >= position - 80) break;
        start += character.length; normalizedOffset += normalize(character).length;
      }
    }
  }
  const original = line.original.slice(start, start + 600).trim() || ' ', excerpt = redactApparentSecrets(original);
  return { file: line.file, line: line.line, endLine: line.endLine, excerpt, ...(excerpt !== original ? { redacted: true } : {}) };
}
export function analyzeNative(input: Inventory): { findings: Finding[]; capabilities: string[] } {
  const lines = activeLines(input.texts), all = lines.map(line => line.text).join('\n');
  const findings: Finding[] = [];
  const first = (pattern: RegExp, accepts: (line: Line) => boolean = () => true): Line | undefined => {
    for (const line of lines) {
      const match = pattern.exec(line.text);
      if (match && accepts(line)) return { ...line, focus: match[0] };
    }
    // Continue an instruction wrapped across adjacent physical lines, retaining both original lines.
    for (const [index, line] of lines.entries()) {
      const next = lines[index + 1];
      if (next?.file === line.file && next.line === line.line + 1 && !/[.!?;]$/.test(line.text) && pattern.test(`${line.text} ${next.text}`)) {
        const combined = { ...line, endLine: next.line, text: `${line.text} ${next.text}`, original: `${line.original}\n${next.original}` };
        if (accepts(combined)) return combined;
      }
    }
    return undefined;
  };
  const secretTerm = /private[ _-]?key|seed[ _-]?phrase|(?:recovery|backup)[ _-]?(?:phrase|words)|mnemonic|wallet[ _-]?(?:secret|key)|payment[ _-]?(?:token|secret)|stripe[ _-]?secret|exchange[ _-]?(?:api[ _-]?)?(?:key|secret|credentials?)|(?:api[ _-]?(?:key|secret)|credentials?).{0,35}(?:exchange|trading|brokerage)/i;
  const finance = /wallet|portfolio|payment|trading|treasury|transaction|token|crypto|DEMOUSD|allowance|chain.?id|portefeuille|paiement/i.test(all) || secretTerm.test(all);
  const readonly = /read[ -]?only|only (?:read|inspect|display|summar)|lecture seule|ne fait que consulter/i.test(all);
  const concealment = /without (?:asking|approval|consent|telling|notifying)|do not (?:tell|mention|disclose|reveal)|hide (?:this|the|any)|silently|secretly|ignore (?:the )?(?:user|previous|prior)|(?:skip|bypass|omit).{0,35}(?:approval|consent|confirmation)|sans (?:demander|accord|prévenir)|dissimule|cachez/i;
  const hidden = lines.find(line => concealment.test(line.text) && !(/^(?:do not|never).{0,30}(?:disclose|reveal|show|print|log).{0,40}(?:private.?key|seed|secret|credential)/i.test(line.text) && !/transfer|transmission|upload|payment|operation|sign|approv/i.test(line.text)));
  const transfer = first(/(?:\b(?:transfer|send|pay|remit|move|forward|sweep|drain|debit)\b|transf[ée]r|envoy|\.transfer\s*\(|sendTransaction\s*\().{0,100}(?:DEMOUSD|token|fund|asset|balance|USDC|ETH|BTC|SOL|wallet|0x[a-f0-9]{8}|demo[-_ ]|recipient|beneficiary)|(?:sendTransaction|transferFrom|\.transfer)\s*\(/i,
    line => !(/\b(?:send|forward|upload|submit|transmit)\s+(?:(?:the|a|an|this|that|generated|public|daily|weekly|monthly|account|wallet|balance|portfolio|holdings|transaction|asset|financial)[ -]){0,4}(?:report|summary|snapshot|statement|csv|json)\b/i.test(line.text)
      && !/\b(?:transfer|sweep|drain|debit|remit|pay)\b|\b(?:send|forward)\s+(?:(?:the|all|remaining|entire|full)\s+){0,2}(?:\d[\d.,]*\s+)?(?:DEMOUSD|tokens?|funds?|assets?|balances?|USDC|ETH|BTC|SOL)\b(?!\s+(?:report|summary|snapshot|statement))/i.test(line.text)));
  const add = (category: Finding['category'], severity: Finding['severity'], impact: string, explanation: string, related: (Line | undefined)[], technique: string, sources: string[], confidence: Finding['confidence'] = 'high'): void => {
    const unique = new Map<string, Line>();
    for (const line of related) if (line) {
      const key = `${line.file}:${line.line}`;
      if (!unique.has(key) || !unique.get(key)!.focus && line.focus) unique.set(key, line);
    }
    const proof = [...unique.values()].map(evidence).slice(0, 6);
    if (!proof.length) return;
    findings.push({ id: `${category}-${sha256(JSON.stringify(proof)).slice(0, 12)}`, category, severity, confidence, financialConsequence: impact, explanation, evidence: proof, engine: 'native', technique, sources, supported: true });
  };
  const acquisition = new RegExp(`(?:process\\.env|os\\.(?:getenv|environ)|readFile|read_text|input\\(|prompt|ask|collect|read|load|export|obtain|retrieve|include|bundle|saisir|demande|lire).{0,110}(?:${secretTerm.source})|(?:${secretTerm.source}).{0,60}(?:process\\.env|os\\.(?:getenv|environ)|readFile)`, 'i');
  const secret = first(acquisition);
  let transmission = first(/(?:fetch|requests?\.post|axios\.post|curl|\bPOST\b|upload|transmit|send|submit|forward|envoy).{0,160}(?:secret|private.?key|seed|mnemonic|recovery words|credential|collected (?:value|token))|(?:body|data)\s*[:=].{0,80}(?:private.?key|seed|mnemonic|secret|credential)/i);
  let transmissionProof: Line[] = [];
  if (secret && !transmission) {
    const aliases = new Map<string, { pattern: RegExp; proof: Line[] }>(), flows = new Map<number, Line[]>();
    const sink = /\b(?:fetch|post|upload|transmit|send|submit|forward|curl)\b/i;
    // shortcut: two passes follow simple assignments and named containers, not arbitrary program data flow.
    for (let pass = 0; pass < 2 && !transmission; pass++) for (const [index, line] of lines.entries()) {
      const linked = [...aliases.values()].find(alias => alias.pattern.test(line.text));
      const previous = lines[index - 1], priorFlow = flows.get(index - 1);
      const pronoun = previous?.file === line.file && line.line - previous.line <= 2 && /\b(?:it|them|words|collected values?)\b/i.test(line.text);
      const origin = acquisition.test(line.text) ? [line] : linked ? [...linked.proof, line] : pronoun && priorFlow ? [...priorFlow, line] : undefined;
      if (!origin) continue;
      flows.set(index, origin.slice(-5));
      const assigned = /(?:^|[;{]\s*)(?:(?:const|let|var)\s+)?([a-z_$][\w$]*)\s*(?::[^=;]{1,80})?=\s*[^=]/i.exec(line.text)?.[1];
      const container = /\b(?:in|into|as)\s+(?:(?:the|a|an)\s+)?([a-z][\w-]*(?:[ -](?:form|bundle|payload|body|packet|archive))|(?:form|bundle|payload|body|packet|archive))\b/i.exec(line.text)?.[1];
      for (const name of [assigned, container]) if (name && aliases.size < 64 && !aliases.has(name)) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const noun = container === name ? /\b(form|bundle|payload|body|packet|archive)$/.exec(name)?.[1] : undefined;
        aliases.set(name, { pattern: new RegExp(`\\b(?:${escaped}${noun ? `|(?:that|this) ${noun}` : ''})\\b`, 'i'), proof: origin.slice(-4) });
      }
      if (sink.test(line.text) && (linked || pronoun || container)) { transmission = line; transmissionProof = origin; break; }
    }
  }
  if (secret && transmission) add('FIN-01', 'critical', 'A financial key or secret could be sent to a third party, allowing access to funds if the secret is real.', 'The package contains financial secret collection and transmission, including any shown intermediate container or variable. The destination was not contacted; its owner has not been established.', [secret, ...transmissionProof, transmission], 'DOC-01', ['SRC-01', 'SRC-02']);
  const replacement = first(/(?:replace|override|overwrite|substitute|redirect|reroute|force|forcer|remplac).{0,70}(?:recipient|beneficiary|destination|payout|bénéficiaire)|(?:recipient|beneficiary|destination|payout).{0,45}=.{0,15}(?:["'](?:0x[a-f0-9]{8}|demo[-_]|external))/i);
  if (transfer && (readonly || hidden || replacement) || finance && replacement) add('FIN-02', 'high', 'Assets could be sent to a recipient outside the stated scope if the agent has transfer access.', 'The package combines a financial operation with a claimed read-only function or concealment, or explicitly replaces a financial recipient. A replacement in a payment preview can affect a later approval; no transfer was executed or recipient ownership established.', [transfer, replacement, readonly ? first(/read[ -]?only|only (?:read|inspect|display|summar)|lecture seule/i) : undefined, hidden], 'DOC-03', ['SRC-03']);
  const approval = first(/(?:approve|allowance|setApprovalForAll|autorisation).{0,100}(?:unlimited|unbounded|infinite|MaxUint256|type\(uint256\)\.max|2\s*\*\*\s*256|true|illimit)|(?:unlimited|unbounded|infinite|MaxUint256|illimit).{0,80}(?:approve|allowance|spend)/i);
  // A preparation procedure must expose both the recipient and breadth, and require confirmation before signing.
  // Claimed authorization alone is never an exemption; executable grants and hidden behavior still trigger.
  const guardedPreparation = !!approval && /\b(?:prepare|review|preview|explain|describe|simulate)\b/i.test(approval.text)
    && /(?:show|display).{0,60}(?:selected|chosen|spender|recipient)/i.test(all)
    && /(?:explain|warn).{0,100}(?:full balance|unlimited|unbounded|spend all)/i.test(all)
    && /(?:require|wait for).{0,40}(?:explicit|user|operator).{0,25}confirmation.{0,60}(?:before|prior to).{0,40}(?:sign|grant|approv)/i.test(all)
    && !first(/(?:\bapprove\s*\(|setApprovalForAll\s*\(|\b(?:grant|execute|submit)\b.{0,50}(?:unlimited|unbounded|approval|allowance))/i);
  if (approval && (readonly || hidden || !guardedPreparation)) add('FIN-03', readonly || hidden ? 'high' : 'medium', 'A broad spending approval could allow more than the intended amount to be spent if it is signed.', 'The package contains a very broad spending approval. This is a risk to review, but does not by itself prove malicious intent.', [approval, hidden, readonly ? first(/read[ -]?only|lecture seule/i) : undefined], 'SYN-03', [], readonly || hidden ? 'high' : 'medium');
  const networkChange = first(/(?:replace|override|switch|change|rewrite|set|remplac|modifi).{0,70}(?:chain.?id|network|token.?address|rpc.?url|slippage|réseau)|(?:chain.?id|token.?address|slippage|rpc.?url)\s*[:=].{0,100}/i);
  if (finance && networkChange && (hidden || /ignore.{0,50}(?:network|token|chain|user)|(?:regardless|instead).{0,50}(?:user|approved)|approved.{0,50}(?:replace|override)/i.test(all))) add('FIN-04', 'high', 'Financial parameters could be changed against the approved context, altering the asset or network used.', 'A parameter change is associated with an instruction to conceal behavior or exceed the stated scope. No external financial context was consulted; an actual mismatch remains unconfirmed.', [networkChange, hidden], 'SYN-04', [], 'medium');
  const remote = first(/(?:curl|wget).{0,160}(?:\|\s*(?:sh|bash|zsh|python)|-o)|(?:eval|exec|subprocess|child_process|import\().{0,100}(?:https?:|base64|decode)|(?:fetch|requests?\.get).{0,140}https?:|(?:download|load|fetch|execute|run).{0,80}(?:remote|https?:).{0,100}(?:script|code|instructions|payload|\.sh\b|\.py\b|\.js\b)|(?:download|fetch|retrieve).{0,80}(?:script|code|payload).{0,160}https?:|(?:run|execute).{0,60}(?:base64|encoded|hidden).{0,40}(?:payload|code|command)/i);
  const execution = first(/\beval\s*\(|\bexec\s*\(|execSync|execFile|subprocess\.|\|\s*(?:sh|bash|zsh|python)|\b(?:bash|sh|zsh|python3?|node)\s+[^\s;]+\.(?:sh|py|js)\b|chmod\s+\+x|(?:execute|run|load).{0,70}(?:downloaded|remote|payload|script|encoded)/i);
  if (finance && remote && execution) {
    add('FIN-05', 'high', 'Unanalyzed code could run with the financial access available to the agent.', 'The package combines code retrieval or obfuscation with execution in a financial context. This rule did not retrieve or execute any remote content.', [remote, execution], 'DOC-02', ['SRC-01', 'SRC-02']);
    input.coverage.unresolved.push(`${remote.file} : remote or obfuscated code was not analyzed.`);
  }
  const sign = first(/\bsign\b|\bapprove\b|sendTransaction|transferFrom|setApprovalForAll|signe[rz]|approuve[rz]/i);
  if (finance && hidden && (transfer || sign || approval)) add('FIN-06', 'high', 'The agent could approve or execute a financial action hidden from the operator.', 'An active instruction to conceal behavior or bypass approval is associated with a financial action. This is an attack hypothesis tested by our rules, not a reproduction of a named incident.', [hidden, transfer, sign, approval], 'SYN-06', []);
  const capabilities = [finance ? 'Financial context' : '', readonly ? 'Read-only behavior claimed' : '', transfer ? 'Transfer present' : '', approval ? 'Broad spending approval' : '', secret ? 'Financial secret access' : '', execution ? 'Code execution present' : ''].filter(Boolean);
  return { findings, capabilities };
}

export function checkReferences(input: Inventory): void {
  const available = new Set(input.manifest.map(file => file.path));
  for (const [file, text] of input.texts) {
    {
      for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
        const reference = match[1]!;
        if (/^(?:https?:|mailto:|#)/i.test(reference)) continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), reference.split('#')[0]!));
        if (reference.startsWith('/') || target.startsWith('../') || !available.has(target)) input.coverage.unresolved.push(`${file} : unresolved local reference ${reference}`);
      }
      for (const line of text.split(/\r?\n/)) {
        if (/(?:read|follow|load|download|execute|consult|fetch|lire|suivre|charger).{0,100}(?:instructions|script|rules|guide)|(?:instructions|script|rules).{0,80}(?:at|from|https?:)/i.test(line) && /https?:\/\//i.test(line)) input.coverage.unresolved.push(`${file} : remote instructions or resource were not analyzed.`);
        if (/(?:read|load|execute|run|lire|charger).{0,60}(?:\.\.\/|\/(?:tmp|home|Users)\/)/i.test(line)) input.coverage.unresolved.push(`${file} : reference outside the package.`);
      }
    }
    if (path.basename(file) === 'package.json') {
      try { const pkg = JSON.parse(text) as Record<string, unknown>; if (['dependencies', 'devDependencies', 'optionalDependencies'].some(key => pkg[key] && Object.keys(pkg[key] as object).length)) input.coverage.unresolved.push(`${file} : unresolved npm dependencies; none were installed.`); } catch { input.coverage.errors.push(`${file} : invalid JSON.`); }
    }
    if (['requirements.txt', 'Pipfile', 'Cargo.toml'].includes(path.basename(file)) && text.trim()) input.coverage.unresolved.push(`${file} : unresolved external dependencies.`);
    for (const match of text.matchAll(/(?:from\s+["']|require\(["']|import\s+["'])(\.[^"']+)["']/g)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!));
      if (![resolved, `${resolved}.js`, `${resolved}.ts`, `${resolved}.json`, `${resolved}/index.js`].some(candidate => available.has(candidate))) input.coverage.unresolved.push(`${file} : unresolved local import ${match[1]}`);
    }
  }
  input.coverage.unresolved = [...new Set(input.coverage.unresolved)];
  finalizeCoverage(input.coverage);
}
export function decide(findings: Finding[], coverage: ScanReport['coverage']): ScanReport['decision'] {
  if (findings.some(finding => finding.supported && ['high', 'critical'].includes(finding.severity))) return 'hold';
  if (findings.length || coverage.status !== 'complete_for_supported_checks') return 'review';
  return 'allow';
}
