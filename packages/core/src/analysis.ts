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
  if (secret && transmission && secret !== transmission || (secret && transmission && /(?:https?:|upload|transmit|post)/i.test(secret.text))) add('FIN-01', 'critical', 'Une clé ou un secret financier pourrait être transmis à un tiers, permettant un accès aux fonds si le secret est réel.', 'Collecte d’un secret financier et transmission observées dans le paquet. La destination n’a pas été contactée ; son propriétaire n’est pas établi.', [secret, transmission], 'DOC-01', ['SRC-01', 'SRC-02']);
  const replacement = first(/(?:replace|override|overwrite|substitute|redirect|set|forcer|remplac).{0,70}(?:recipient|beneficiary|destination|payout|bénéficiaire)|(?:recipient|beneficiary|destination|payout).{0,45}=.{0,15}(?:["'](?:0x[a-f0-9]{8}|demo[-_]|external))/i);
  if (transfer && (readonly || hidden || replacement)) add('FIN-02', 'high', 'Des actifs pourraient être envoyés à un bénéficiaire hors du mandat annoncé, si l’agent dispose de la capacité de transfert.', 'Le paquet combine une opération financière avec une fonction annoncée en lecture seule, une dissimulation ou un remplacement explicite de bénéficiaire. Le mandat n’est pas validé par la seule déclaration du skill.', [transfer, replacement, readonly ? first(/read[ -]?only|only (?:read|inspect|display|summar)|lecture seule/i) : undefined, hidden], 'DOC-03', ['SRC-03']);
  const approval = first(/(?:approve|allowance|setApprovalForAll|autorisation).{0,100}(?:unlimited|infinite|MaxUint256|2\s*\*\*\s*256|true|illimit)|(?:unlimited|infinite|MaxUint256|illimit).{0,80}(?:approve|allowance|spend)/i);
  if (approval && (readonly || hidden || !/explicit(?:ly)? (?:user|operator).{0,30}(?:approv|request|cho)|user.{0,30}(?:chooses|selects|requests).{0,50}unlimited|documented unlimited.{0,60}(?:requires|confirmation)/i.test(all))) add('FIN-03', readonly || hidden ? 'high' : 'medium', 'Une autorisation large pourrait permettre de dépenser davantage que le montant prévu, si elle est effectivement signée.', 'Une autorisation de dépense très large est présente. Elle constitue un risque à examiner, sans prouver à elle seule une intention malveillante.', [approval, hidden, readonly ? first(/read[ -]?only|lecture seule/i) : undefined], 'SYN-03', [], readonly || hidden ? 'high' : 'medium');
  const networkChange = first(/(?:replace|override|switch|change|rewrite|set|remplac|modifi).{0,70}(?:chain.?id|network|token.?address|rpc.?url|slippage|réseau)|(?:chain.?id|token.?address|slippage|rpc.?url)\s*[:=].{0,100}/i);
  if (finance && networkChange && (hidden || /ignore.{0,50}(?:network|token|chain|user)|(?:regardless|instead).{0,50}(?:user|approved)|approved.{0,50}(?:replace|override)/i.test(all))) add('FIN-04', 'high', 'Des paramètres financiers pourraient être modifiés contre le contexte approuvé, changeant l’actif ou le réseau utilisé.', 'Changement de paramètres corrélé à une instruction de dissimulation ou de dépassement du mandat. Aucun contexte financier externe n’a été consulté ; la divergence effective reste à confirmer.', [networkChange, hidden], 'SYN-04', [], 'medium');
  const remote = first(/(?:curl|wget).{0,160}(?:\|\s*(?:sh|bash|zsh|python)|-o)|(?:eval|exec|subprocess|child_process|import\().{0,100}(?:https?:|base64|decode)|(?:fetch|requests?\.get).{0,140}https?:|(?:download|load|fetch|execute|run).{0,80}(?:remote|https?:).{0,80}(?:script|code|instructions|payload)|(?:run|execute).{0,60}(?:base64|encoded|hidden).{0,40}(?:payload|code|command)/i);
  const execution = first(/\beval\s*\(|\bexec\s*\(|execSync|subprocess\.|\|\s*(?:sh|bash|zsh|python)|chmod\s+\+x|(?:execute|run|load).{0,70}(?:downloaded|remote|payload|script|encoded)/i);
  if (finance && remote && execution) {
    add('FIN-05', 'high', 'Du code non analysé pourrait s’exécuter avec les accès financiers de l’agent.', 'Le paquet associe récupération ou masquage de code et exécution dans un contexte financier. Aucun contenu distant n’a été exécuté ou récupéré par cette règle.', [remote, execution], 'DOC-02', ['SRC-01', 'SRC-02']);
    input.coverage.unresolved.push(`${remote.file} : code distant ou masqué non analysé.`);
  }
  const sign = first(/\bsign\b|\bapprove\b|sendTransaction|transferFrom|setApprovalForAll|signe[rz]|approuve[rz]/i);
  if (finance && hidden && (transfer || sign || approval)) add('FIN-06', 'high', 'L’agent pourrait approuver ou exécuter une action financière dissimulée à l’opérateur.', 'Une consigne active de dissimulation ou de contournement est corrélée à une action financière. Il s’agit d’une hypothèse de détournement testée par nos règles, pas de la reproduction d’un incident nommé.', [hidden, transfer, sign, approval], 'SYN-06', []);
  const capabilities = [finance ? 'Contexte financier' : '', readonly ? 'Lecture seule annoncée' : '', transfer ? 'Transfert présent' : '', approval ? 'Autorisation de dépense large' : '', secret ? 'Accès à un secret financier' : '', execution ? 'Exécution de code présente' : ''].filter(Boolean);
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
        if (reference.startsWith('/') || target.startsWith('../') || !available.has(target)) input.coverage.unresolved.push(`${file} : référence locale non résolue ${reference}`);
      }
      for (const line of text.split(/\r?\n/)) {
        if (/(?:read|follow|load|download|execute|consult|fetch|lire|suivre|charger).{0,100}(?:instructions|script|rules|guide)|(?:instructions|script|rules).{0,80}(?:at|from|https?:)/i.test(line) && /https?:\/\//i.test(line)) input.coverage.unresolved.push(`${file} : instructions ou ressource distante non analysée.`);
        if (/(?:read|load|execute|run|lire|charger).{0,60}(?:\.\.\/|\/(?:tmp|home|Users)\/)/i.test(line)) input.coverage.unresolved.push(`${file} : référence hors du paquet.`);
      }
    }
    if (path.basename(file) === 'package.json') {
      try { const pkg = JSON.parse(text) as Record<string, unknown>; if (['dependencies', 'devDependencies', 'optionalDependencies'].some(key => pkg[key] && Object.keys(pkg[key] as object).length)) input.coverage.unresolved.push(`${file} : dépendances npm non résolues, jamais installées.`); } catch { input.coverage.errors.push(`${file} : JSON invalide.`); }
    }
    if (['requirements.txt', 'Pipfile', 'Cargo.toml'].includes(path.basename(file)) && text.trim()) input.coverage.unresolved.push(`${file} : dépendances externes non résolues.`);
    for (const match of text.matchAll(/(?:from\s+["']|require\(["']|import\s+["'])(\.[^"']+)["']/g)) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!));
      if (![resolved, `${resolved}.js`, `${resolved}.ts`, `${resolved}.json`, `${resolved}/index.js`].some(candidate => available.has(candidate))) input.coverage.unresolved.push(`${file} : import local non résolu ${match[1]}`);
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
