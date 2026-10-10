import type { ScanReport } from '../../../packages/contracts/src/index.js';
import { sanitizeTerminal } from '../../../packages/core/src/storage.js';

type Block = { kind: 'heading'; text: string; level: 1 | 2 | 3 }
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'evidence'; location: string; excerpt: string };
const clean = (value: unknown) => sanitizeTerminal(String(value));
const inline = (value: unknown) => clean(value).replace(/[\r\n\t]+/g, ' ');
const seconds = (value: number | undefined) => value === undefined ? 'Not recorded' : `${(value / 1000).toFixed(2)} s`;
const count = (value: number) => value.toLocaleString('en-US');
const categories: Record<string, string> = {
  'FIN-01': 'Secret collection or transmission', 'FIN-02': 'Unauthorized beneficiary', 'FIN-03': 'Excessive approval',
  'FIN-04': 'Hidden financial parameters', 'FIN-05': 'Remote or obscured execution', 'FIN-06': 'Concealed financial instructions',
};
function stageOf(stage: ScanReport['analyses'][number]): 'native' | 'semantic' | 'behavioral' {
  return stage.stage ?? (stage.engine === 'native' ? 'native' : stage.engine === 'behavioral' ? 'behavioral' : 'semantic');
}
function blocks(report: ScanReport): Block[] {
  const behavior = report.behavioral;
  const decision = report.decision === 'allow' ? 'READY TO INSTALL' : report.decision === 'hold' ? 'INSTALLATION HELD' : 'REVIEW REQUIRED';
  const out: Block[] = [
    { kind: 'heading', level: 1, text: `SkillGate · ${report.name}` },
    { kind: 'text', text: `${decision} · ${report.profile.toUpperCase()} profile · ${seconds(report.durationMs)}` },
    { kind: 'text', text: 'This is an installation decision for the analyzed snapshot, not a safety certification. A report alone does not activate a skill.' },
    { kind: 'text', text: `Source: ${report.source.locator}${report.source.revision ? ` @ ${report.source.revision}` : ''}` },
    { kind: 'text', text: `Snapshot SHA-256: ${report.fingerprint}` },
    { kind: 'text', text: `Scan: ${report.id} · Completed: ${report.completedAt}` },
    { kind: 'heading', level: 2, text: 'Analysis stages' },
  ];
  const stages = [['native', '1. Regex / static checks'], ['semantic', '2. LLM financial review'], ['behavioral', '3. Agent execution']] as const;
  out.push({ kind: 'table', headers: ['Stage', 'Status', 'Duration', 'Model'], rows: stages.map(([id, name]) => {
    const stage = report.analyses.find(item => stageOf(item) === id);
    const required = id === 'native' || (id === 'semantic' && report.profile !== 'static') || (id === 'behavioral' && report.profile === 'full');
    return [name, stage?.status.toUpperCase() ?? (required ? 'UNAVAILABLE' : 'NOT REQUESTED'), seconds(stage?.durationMs), stage?.model ?? '—'];
  }) });
  for (const stage of report.analyses) {
    out.push({ kind: 'text', text: `${stage.engine}: ${stage.detail}` });
    if (stage.responseId) out.push({ kind: 'text', text: `Provider response: ${stage.responseId}` });
  }
  out.push({ kind: 'heading', level: 2, text: `Financial risk evidence (${report.findings.length})` });
  if (!report.findings.length) out.push({ kind: 'text', text: 'No supported static or semantic finding recorded. Check stage completion and coverage before interpreting this result.' });
  for (const finding of report.findings) {
    out.push({ kind: 'heading', level: 3, text: `${finding.category} · ${categories[finding.category] ?? finding.category} · ${finding.severity.toUpperCase()}` },
      { kind: 'text', text: `${finding.engine} · confidence ${finding.confidence} · evidence ${finding.supported ? 'supported' : 'unsupported'}` },
      { kind: 'text', text: finding.financialConsequence }, { kind: 'text', text: finding.explanation });
    for (const evidence of finding.evidence) out.push({ kind: 'evidence', location: `${evidence.file}:${evidence.line}${evidence.endLine !== evidence.line ? `–${evidence.endLine}` : ''}${evidence.redacted ? ' (apparent secrets redacted)' : ''}`, excerpt: evidence.excerpt });
    if (finding.sources.length) out.push({ kind: 'text', text: `Source references: ${finding.sources.join(', ')}` });
  }
  out.push({ kind: 'heading', level: 2, text: 'Agent execution and task completion' });
  if (!behavior) out.push({ kind: 'text', text: 'NOT EXECUTED. No agent behavior or transfer result is available in this report.' });
  else {
    out.push({ kind: 'text', text: `${behavior.kind === 'mocked-test' ? 'MOCKED TEST — no live provider or chain proof' : behavior.tasks.length && behavior.chain ? 'Actual API model with a local Fuji fork' : 'Live provider configured — execution did not start'} · ${behavior.model}` },
      { kind: 'text', text: `With skill: ${behavior.verdict} · Baseline: ${behavior.baselineVerdict} · Execution ${behavior.complete ? 'complete' : 'INCOMPLETE'} · Coverage ${behavior.covered ? 'covered for supported checks' : 'NOT COVERED'}` },
      { kind: 'text', text: behavior.reason });
    if (behavior.chain) out.push({ kind: 'text', text: `Local fork: chain ${behavior.chain.chainId}, upstream block ${behavior.chain.forkBlockNumber}. No public transaction or real wallet.` });
    out.push({ kind: 'table', headers: ['Task', 'Baseline completed / intended recipient reached', 'With skill completed / intended recipient reached', 'Transfers baseline / skill'], rows: behavior.tasks.map(task => [task.task,
      `${task.baselineComplete ? 'Yes' : 'No'} / ${task.baselineTaskComplete ? 'Yes' : 'No'}`,
      `${task.skillComplete ? 'Yes' : 'No'} / ${task.skillTaskComplete ? 'Yes' : 'No'}`, `${task.baselineTransfers} / ${task.skillTransfers}`]) });
    out.push({ kind: 'text', text: `Recipient-provenance violations: ${behavior.violations.length}. BENIGN means no recipient outside the address book or current task was observed; it does not mean the whole skill is safe.` });
    for (const violation of behavior.violations) {
      out.push({ kind: 'heading', level: 3, text: `Unexpected recipient · ${violation.taskId}` },
        { kind: 'text', text: `Task: ${violation.task}` },
        { kind: 'text', text: `Expected: ${violation.expectedRecipients.join(', ')}` },
        { kind: 'text', text: `Observed recipient: ${violation.actualRecipient} · ${violation.amountAVAX} AVAX` });
      if (violation.transactionHash) out.push({ kind: 'text', text: `Local transaction: ${violation.transactionHash}` });
    }
    if (behavior.evidence) out.push({ kind: 'text', text: `Local execution evidence: ${behavior.evidence.path} · SHA-256 ${behavior.evidence.sha256}` });
  }
  out.push({ kind: 'heading', level: 2, text: 'Coverage and untested behavior' },
    { kind: 'text', text: `${report.coverage.status} · ${report.coverage.read}/${report.coverage.inventoried} files read · ${report.coverage.supported} supported files · ${count(report.coverage.bytes)} bytes` });
  const gaps = [...report.coverage.errors, ...report.coverage.limitsReached, ...report.coverage.unresolved,
    ...report.coverage.ignored.map(item => `${item.file}: ${item.reason}`), ...(behavior?.errors ?? [])];
  if (gaps.length) out.push({ kind: 'list', items: [...new Set(gaps)] });
  out.push({ kind: 'list', items: [...new Set([...report.limitations, ...(behavior?.limitations ?? []),
    'Static rules and LLM review identify supported financial risks; neither proves complete behavior.',
    'Agent execution exposes only the send tool on fixed AVAX tasks. Shell commands, downloads, network exfiltration, token approvals, staking, and key theft do not execute in this harness.',
    'The recipient oracle allows every address-book contact and addresses in the task. Swaps between trusted contacts and amount-only manipulation are outside that oracle.',
    'One execution is not a guarantee against conditional behavior or model variability.'])] });
  out.push({ kind: 'heading', level: 2, text: 'Measured resources' });
  const usageRows = report.analyses.filter(stage => stage.usage).map(stage => [stage.engine, count(stage.usage!.inputTokens), count(stage.usage!.outputTokens), count(stage.usage!.totalTokens)]);
  if (behavior && !report.analyses.some(stage => stageOf(stage) === 'behavioral' && stage.usage)) usageRows.push(['Agent execution', count(behavior.inputTokens), count(behavior.outputTokens), count(behavior.inputTokens + behavior.outputTokens)]);
  if (usageRows.length) out.push({ kind: 'table', headers: ['Recorded provider usage', 'Input tokens', 'Output tokens', 'Total tokens'], rows: usageRows });
  else out.push({ kind: 'text', text: 'Provider usage not recorded. Missing measurements are not zero usage.' });
  out.push({ kind: 'text', text: `Total scan elapsed: ${seconds(report.durationMs)}. Token counts are recorded provider usage, not a verified bill; unavailable stages may have unknown usage.` });
  return out;
}

export function fullReportTerminal(report: ScanReport): string {
  return blocks(report).map(block => {
    if (block.kind === 'heading') return `\n${clean(block.text)}`;
    if (block.kind === 'text') return clean(block.text);
    if (block.kind === 'list') return block.items.map(item => `  - ${inline(item)}`).join('\n');
    if (block.kind === 'evidence') return `  ${inline(block.location)}\n  > ${inline(block.excerpt)}`;
    return [block.headers, ...block.rows].map(row => row.map(inline).join(' | ')).join('\n');
  }).join('\n').trim() + '\n';
}
const html = (value: unknown) => clean(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const md = (value: string) => inline(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1');
export function fullReportMarkdown(report: ScanReport): string {
  return blocks(report).map(block => {
    if (block.kind === 'heading') return `${'#'.repeat(block.level)} ${md(block.text)}`;
    if (block.kind === 'text') return md(block.text);
    if (block.kind === 'list') return block.items.map(item => `- ${md(item)}`).join('\n');
    if (block.kind === 'evidence') return `**${md(block.location)}**\n\n> ${md(block.excerpt)}`;
    return [`| ${block.headers.map(md).join(' | ')} |`, `| ${block.headers.map(() => '---').join(' | ')} |`, ...block.rows.map(row => `| ${row.map(md).join(' | ')} |`)].join('\n');
  }).join('\n\n') + '\n';
}
export function fullReportHtml(report: ScanReport): string {
  const content = blocks(report).map(block => {
    if (block.kind === 'heading') return `<h${block.level}>${html(block.text)}</h${block.level}>`;
    if (block.kind === 'text') return `<p>${html(block.text)}</p>`;
    if (block.kind === 'list') return `<ul>${block.items.map(item => `<li>${html(item)}</li>`).join('')}</ul>`;
    if (block.kind === 'evidence') return `<figure><figcaption>${html(block.location)}</figcaption><pre>${html(block.excerpt)}</pre></figure>`;
    return `<div class="table" tabindex="0" role="region" aria-label="Scrollable report table"><table><thead><tr>${block.headers.map(item => `<th scope="col">${html(item)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(item => `<td>${html(item)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>SkillGate · ${html(report.name)}</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f7f8f5;color:#18342f;margin:0}main{max-width:1050px;margin:36px auto;padding:28px}h1{font-size:32px;letter-spacing:-.03em}h2{font-size:23px;border-top:1px solid #c7d5cd;padding-top:28px;margin-top:36px}h3{font-size:18px}p,li,td,figcaption{overflow-wrap:anywhere}figure{margin:16px 0;border-left:4px solid #557764;background:#fff;padding:16px}figcaption{font-weight:650;font-size:14px}pre{font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:0}.table{overflow-x:auto}.table:focus-visible{outline:2px solid #33634b;outline-offset:3px}table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}th,td{text-align:left;vertical-align:top;padding:12px;border:1px solid #d5dfd9}th{background:#eaf0eb}li{margin:6px 0}@media(max-width:600px){main{padding:20px;margin:0}h1{font-size:27px}th,td{padding:8px;min-width:95px}}@media print{body{background:#fff}main{margin:0;padding:0}h2,h3{break-after:avoid}figure,tr{break-inside:avoid}}</style></head><body><main>${content}</main></body></html>`;
}
