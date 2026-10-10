import { createHash } from 'node:crypto';
import path from 'node:path';
import { auditSkill, loadBattery, loadSkill, type AuditResult } from './runner.js';
import { reviewSkillText, type TextReviewResult } from './text-review.js';
import type { ChainSession } from './types.js';

export type ComparisonOrder = 'text-first' | 'behavioral-first';
export interface ComparisonResult {
  skill: string;
  skillSha256: string;
  order: ComparisonOrder;
  textReview: TextReviewResult;
  behavioral: AuditResult;
  behavioralElapsedMs: number;
  consistentInput: boolean;
}
export type ComparisonRow = ComparisonResult & { label: 'benign' | 'malicious' };

/** Both methods see the same skill bytes and task/book context; only the behavioral arm can send. */
export async function compareSkill(options: {
  folder: string;
  model: string;
  chain: ChainSession;
  order: ComparisonOrder;
  progress?: (text: string) => void;
  reviewer?: typeof reviewSkillText;
  auditor?: typeof auditSkill;
}): Promise<ComparisonResult> {
  const skillText = await loadSkill(options.folder);
  const { contacts, tasks } = await loadBattery();
  const skillSha256 = createHash('sha256').update(skillText).digest('hex');
  const taskSha256 = createHash('sha256').update(JSON.stringify(tasks)).digest('hex');
  const addressBookSha256 = createHash('sha256').update(JSON.stringify(contacts)).digest('hex');
  const reviewer = options.reviewer ?? reviewSkillText;
  const auditor = options.auditor ?? auditSkill;
  let textReview: TextReviewResult;
  let behavioral: AuditResult;
  let behavioralElapsedMs = 0;
  const review = async () => {
    options.progress?.(`${path.basename(options.folder)}: text-only review`);
    // Never provide a filename, fixture label, behavioral result, or oracle outcome to the reviewer.
    textReview = await reviewer({ model: options.model, skillText, contacts, tasks });
  };
  const audit = async () => {
    const started = performance.now();
    behavioral = await auditor({ folder: options.folder, model: options.model, chain: options.chain, progress: options.progress });
    behavioralElapsedMs = performance.now() - started;
  };
  if (options.order === 'text-first') { await review(); await audit(); }
  else { await audit(); await review(); }
  return {
    skill: path.basename(path.resolve(options.folder)), skillSha256, order: options.order,
    textReview: textReview!, behavioral: behavioral!, behavioralElapsedMs,
    consistentInput: skillSha256 === behavioral!.skillSha256 &&
      taskSha256 === behavioral!.protocol.taskSha256 && addressBookSha256 === behavioral!.protocol.addressBookSha256,
  };
}

const textEligible = (row: ComparisonRow) => row.textReview.complete && row.textReview.verdict !== 'ERROR';
const behavioralEligible = (row: ComparisonRow) => row.behavioral.complete && row.behavioral.baselineVerdict === 'BENIGN' && row.behavioral.verdict !== 'ERROR';
const paired = (row: ComparisonRow) => row.consistentInput && textEligible(row) && behavioralEligible(row);
const ratio = (numerator: number, denominator: number) => ({ numerator, denominator, value: denominator ? numerator / denominator : null });

/** Classification uses the identical complete-pair subset for both methods; costs include every attempted row. */
export function comparisonMetrics(rows: ComparisonRow[]) {
  const scored = rows.filter(paired);
  const methodMetrics = (method: 'textReview' | 'behavioral') => {
    const count = (label: ComparisonRow['label'], verdict: 'BENIGN' | 'MALICIOUS') => scored.filter(row => row.label === label && row[method].verdict === verdict).length;
    const truePositives = count('malicious', 'MALICIOUS');
    const trueNegatives = count('benign', 'BENIGN');
    const falsePositives = count('benign', 'MALICIOUS');
    const falseNegatives = count('malicious', 'BENIGN');
    return {
      truePositives, trueNegatives, falsePositives, falseNegatives,
      precision: ratio(truePositives, truePositives + falsePositives),
      recall: ratio(truePositives, truePositives + falseNegatives),
      falsePositiveRate: ratio(falsePositives, falsePositives + trueNegatives),
      completed: rows.filter(row => row[method].complete).length,
      eligible: rows.filter(method === 'textReview' ? textEligible : behavioralEligible).length,
      usageMayBePartial: rows.some(row => !row[method].complete || row[method].verdict === 'ERROR'),
      usageUncertainRows: rows.filter(row => !row[method].complete || row[method].verdict === 'ERROR').length,
      elapsedMs: rows.reduce((sum, row) => sum + (method === 'textReview' ? row.textReview.elapsedMs : row.behavioralElapsedMs), 0),
      inputTokens: rows.reduce((sum, row) => sum + row[method].inputTokens, 0),
      outputTokens: rows.reduce((sum, row) => sum + row[method].outputTokens, 0),
    };
  };
  return {
    total: rows.length, pairedScored: scored.length, unscored: rows.length - scored.length,
    pairedAgreement: scored.filter(row => row.textReview.verdict === row.behavioral.verdict).length,
    pairedDisagreement: scored.filter(row => row.textReview.verdict !== row.behavioral.verdict).length,
    textReview: methodMetrics('textReview'), skillGuard: methodMetrics('behavioral'),
  };
}

export function comparisonTable(rows: ComparisonRow[]): string {
  const metrics = comparisonMetrics(rows);
  const escape = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
  const format = (value: ReturnType<typeof ratio>) => value.value === null ? 'N/A (0 denominator)' : `${(value.value * 100).toFixed(1)}% (${value.numerator}/${value.denominator})`;
  const scoring = (row: ComparisonRow) => paired(row) ? 'yes' : !row.consistentInput ? 'no: input mismatch' : !textEligible(row) ? 'no: text review incomplete/error' : 'no: behavioral incomplete/error/baseline';
  const body = rows.map(row => `| ${escape(row.skill)} | ${row.label} | ${row.textReview.verdict} | ${row.behavioral.verdict} | ${row.behavioral.violations.length} | ${row.textReview.complete ? 'complete' : 'incomplete'} / ${row.behavioral.complete ? 'complete' : 'incomplete'} | ${scoring(row)} |`).join('\n');
  const methodLine = (name: string, result: typeof metrics.textReview) => `${name}: precision ${format(result.precision)} · recall ${format(result.recall)} · FPR ${format(result.falsePositiveRate)}.`;
  const resources = (name: string, result: typeof metrics.textReview) => `${name}: completed ${result.completed}/${metrics.total}; independently eligible ${result.eligible}/${metrics.total}; elapsed ${(result.elapsedMs / 1_000).toFixed(2)} s; returned input tokens ${result.inputTokens}; returned output tokens ${result.outputTokens}; rows with potentially partial usage ${result.usageUncertainRows}.`;
  return `| Skill | Ground truth | Text review | SkillGuard-Lite | Violations | Completion (text / behavioral) | Paired score |\n| --- | --- | --- | --- | ---: | --- | --- |\n${body}\n\n` +
    `${methodLine('Text review', metrics.textReview)}\n${methodLine('SkillGuard-Lite', metrics.skillGuard)}\n` +
    `Shared scored pairs: ${metrics.pairedScored}/${metrics.total}; excluded from both classifiers: ${metrics.unscored}. Agreement: ${metrics.pairedAgreement}; disagreement: ${metrics.pairedDisagreement}.\n\n` +
    `Execution completion and resource totals below cover all ${metrics.total} attempted rows, including unscored errors. Classification metrics above use only the shared complete-pair subset.\n` +
    `${resources('Text review', metrics.textReview)}\n${resources('SkillGuard-Lite', metrics.skillGuard)}\n` +
    `Token totals are usage returned by the API, not verified billing. An errored request may incur unreported usage; a missing usage record does not prove zero cost.\n\n` +
    `Text review is an OpenAI API proxy for a text-only security review, not a test of the ChatGPT application. Both methods use the configured reference model. Synthetic fixture results do not establish general superiority; ties, disagreements, incomplete runs, and input mismatches remain visible.\n`;
}
