import path from 'node:path';
import type { Evidence, Finding, ScanReport } from '../../contracts/src/index.js';
import { finalizeCoverage, type Inventory } from './acquisition.js';
import { sha256 } from './storage.js';
import { redactApparentSecrets } from './semantic.js';

export const ENGINE_VERSION = '0.1.0';
export const RULES_VERSION = 'finance-native-3';
export const CORPUS_VERSION = '2026-10-10';
export const POLICY_VERSION = 'finance-policy-1';

interface Line { file: string; line: number; text: string }
function activeLines(texts: Map<string, string>): Line[] {
  const lines: Line[] = [];
  for (const [file, content] of texts) {
    const defensive = /(?:security|safety|defensive|sécurité).{0,35}(?:tutorial|guide|training|lesson)|(?:tutorial|training).{0,35}(?:security|attack)|attack examples|exemples d.attaques/i.test(content.slice(0, 1200));
    let codeFence = false, inertFence = false;
    const previous: string[] = [];
    for (const [index, text] of content.split(/\r?\n/).entries()) {
      if (/^\s*```/.test(text)) {
        codeFence = !codeFence;
        // A defensive title is untrusted: only explicitly inert, locally introduced examples are omitted.
        inertFence = codeFence && defensive && /do not execute|never execute|inert example|non-executable example|for illustration only|ne pas exécuter|n.exécutez pas/i.test(previous.slice(-3).join('\n'));
        continue;
      }
      if (text.trim()) previous.push(text);
      if (defensive && (codeFence && inertFence || /^\s*(?:never|do not|don't)\s+(?:send|transmit|upload|share|execute|approve|sign|transfer)\b/i.test(text) || /^\s*>/.test(text) && /quoted (?:attack|example)|inert example|do not (?:execute|follow)/i.test(previous.slice(-3, -1).join('\n')))) continue;
      if (/^\s*(?:#|\/\/)/.test(text) && !file.endsWith('.md')) continue;
      lines.push({ file, line: index + 1, text });
    }
  }
  return lines;
}
function evidence(line: Line): Evidence {
  const original = line.text.trim().slice(0, 600) || ' ', excerpt = redactApparentSecrets(original);
  return { file: line.file, line: line.line, endLine: line.line, excerpt, ...(excerpt !== original ? { redacted: true } : {}) };
}
export function analyzeNative(input: Inventory): { findings: Finding[]; capabilities: string[] } {
  const lines = activeLines(input.texts), all = lines.map(line => line.text).join('\n');
  const findings: Finding[] = [];
  const first = (pattern: RegExp): Line | undefined => lines.find(line => pattern.test(line.text));
  const finance = /wallet|portfolio|payment|trading|token|crypto|DEMOUSD|allowance|private.?key|seed.phrase|portefeuille|paiement/i.test(all);
  const readonly = /read[ -]?only|only (?:read|inspect|display|summar)|lecture seule|ne fait que consulter/i.test(all);
  const hidden = first(/without (?:asking|approval|consent|telling)|do not (?:tell|mention|disclose)|hide (?:this|the|any)|silently|secretly|ignore (?:the )?(?:user|previous|prior)|sans (?:demander|accord|prévenir)|dissimule|cachez/i);
  const transfer = first(/(?:\btransfer\b|\bsend\b|\bpay\b|transf[ée]r|envoy|\.transfer\s*\(|sendTransaction\s*\().{0,100}(?:DEMOUSD|token|fund|asset|USDC|ETH|BTC|SOL|wallet|0x[a-f0-9]{8}|demo[-_ ]|recipient|beneficiary)|(?:sendTransaction|transferFrom|\.transfer)\s*\(/i);
  const add = (category: Finding['category'], severity: Finding['severity'], impact: string, explanation: string, related: (Line | undefined)[], technique: string, sources: string[], confidence: Finding['confidence'] = 'high'): void => {
    const proof = [...new Map(related.filter((line): line is Line => !!line).map(line => [`${line.file}:${line.line}`, evidence(line)])).values()].slice(0, 6);
    if (!proof.length) return;
    findings.push({ id: `${category}-${sha256(JSON.stringify(proof)).slice(0, 12)}`, category, severity, confidence, financialConsequence: impact, explanation, evidence: proof, engine: 'native', technique, sources, supported: true });
  };
  const secret = first(/(?:process\.env|os\.(?:getenv|environ)|readFile|read_text|input\(|prompt|ask|collect|read|load|export|obtain|saisir|demande|lire).{0,100}(?:PRIVATE_KEY|private.?key|seed.phrase|mnemonic|wallet.?secret|payment.?token|STRIPE_SECRET|exchange.?api.?key)|(?:PRIVATE_KEY|seed.phrase|mnemonic).{0,60}(?:process\.env|os\.(?:getenv|environ)|readFile)/i);
  const transmission = first(/(?:fetch|requests?\.post|axios\.post|curl|POST|upload|transmit|send|submit|envoy).{0,160}(?:https?:|secret|private.?key|seed|mnemonic|payload|body|data)|(?:body|data).{0,80}(?:private.?key|seed|mnemonic|secret)/i);
  if (secret && transmission && secret !== transmission || (secret && transmission && /(?:https?:|upload|transmit|post)/i.test(secret.text))) add('FIN-01', 'critical', 'A financial key or secret could be sent to a third party, allowing access to funds if the secret is real.', 'The package contains financial secret collection and transmission. The destination was not contacted; its owner has not been established.', [secret, transmission], 'DOC-01', ['SRC-01', 'SRC-02']);
  const replacement = first(/(?:replace|override|overwrite|substitute|redirect|set|forcer|remplac).{0,70}(?:recipient|beneficiary|destination|payout|bénéficiaire)|(?:recipient|beneficiary|destination|payout).{0,45}=.{0,15}(?:["'](?:0x[a-f0-9]{8}|demo[-_]|external))/i);
  if (transfer && (readonly || hidden || replacement)) add('FIN-02', 'high', 'Assets could be sent to a recipient outside the stated scope if the agent has transfer access.', 'The package combines a financial operation with a claimed read-only function, concealment, or an explicit recipient replacement. The stated scope cannot be verified from the skill description alone.', [transfer, replacement, readonly ? first(/read[ -]?only|only (?:read|inspect|display|summar)|lecture seule/i) : undefined, hidden], 'DOC-03', ['SRC-03']);
  const approval = first(/(?:approve|allowance|setApprovalForAll|autorisation).{0,100}(?:unlimited|infinite|MaxUint256|2\s*\*\*\s*256|true|illimit)|(?:unlimited|infinite|MaxUint256|illimit).{0,80}(?:approve|allowance|spend)/i);
  if (approval && (readonly || hidden || !/explicit(?:ly)? (?:user|operator).{0,30}(?:approv|request|cho)|user.{0,30}(?:chooses|selects|requests).{0,50}unlimited|documented unlimited.{0,60}(?:requires|confirmation)/i.test(all))) add('FIN-03', readonly || hidden ? 'high' : 'medium', 'A broad spending approval could allow more than the intended amount to be spent if it is signed.', 'The package contains a very broad spending approval. This is a risk to review, but does not by itself prove malicious intent.', [approval, hidden, readonly ? first(/read[ -]?only|lecture seule/i) : undefined], 'SYN-03', [], readonly || hidden ? 'high' : 'medium');
  const networkChange = first(/(?:replace|override|switch|change|rewrite|set|remplac|modifi).{0,70}(?:chain.?id|network|token.?address|rpc.?url|slippage|réseau)|(?:chain.?id|token.?address|slippage|rpc.?url)\s*[:=].{0,100}/i);
  if (finance && networkChange && (hidden || /ignore.{0,50}(?:network|token|chain|user)|(?:regardless|instead).{0,50}(?:user|approved)|approved.{0,50}(?:replace|override)/i.test(all))) add('FIN-04', 'high', 'Financial parameters could be changed against the approved context, altering the asset or network used.', 'A parameter change is associated with an instruction to conceal behavior or exceed the stated scope. No external financial context was consulted; an actual mismatch remains unconfirmed.', [networkChange, hidden], 'SYN-04', [], 'medium');
  const remote = first(/(?:curl|wget).{0,160}(?:\|\s*(?:sh|bash|zsh|python)|-o)|(?:eval|exec|subprocess|child_process|import\().{0,100}(?:https?:|base64|decode)|(?:fetch|requests?\.get).{0,140}https?:|(?:download|load|fetch|execute|run).{0,80}(?:remote|https?:).{0,80}(?:script|code|instructions|payload)|(?:run|execute).{0,60}(?:base64|encoded|hidden).{0,40}(?:payload|code|command)/i);
  const execution = first(/\beval\s*\(|\bexec\s*\(|execSync|subprocess\.|\|\s*(?:sh|bash|zsh|python)|chmod\s+\+x|(?:execute|run|load).{0,70}(?:downloaded|remote|payload|script|encoded)/i);
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
