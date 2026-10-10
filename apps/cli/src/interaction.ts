import { createInterface } from 'node:readline';
import type { InstallRecord, ScanReport } from '../../../packages/contracts/src/index.js';

export function question(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve, reject) => {
    let answered = false;
    rl.once('close', () => {
      if (!answered) reject(Object.assign(new Error('Installation cancelled.'), { exitCode: 130 }));
    });
    rl.once('SIGINT', () => rl.close());
    rl.question(prompt, answer => {
      answered = true;
      rl.close();
      resolve(answer);
    });
  });
}

export function reportText(report: ScanReport, installation?: InstallRecord): string {
  const headline = installation?.status === 'installed_with_exception'
    ? 'Installed with exception. The reported risks remain.'
    : installation ? 'Installed automatically. No risk detected within the analyzed scope.'
    : report.decision === 'allow' ? 'No risk detected within the analyzed scope.'
    : report.findings[0]?.financialConsequence ?? 'Analysis incomplete: installation suspended.';
  const evidence = report.findings.map(finding =>
    `${finding.category} · ${finding.severity} — ${finding.explanation}\nRisk: ${finding.financialConsequence}\n${finding.evidence.map(item => `  ${item.file}:${item.line} ${item.excerpt}`).join('\n')}`
  ).join('\n');
  return [
    headline,
    `${report.name} · ${report.profile === 'static' ? 'Static analysis' : 'Hybrid analysis'} · ${report.coverage.status}`,
    evidence,
    ...report.coverage.errors,
    ...report.coverage.limitsReached,
    `Report: ${report.id}`,
    `Fingerprint: ${report.fingerprint}`,
    !installation && report.decision !== 'allow'
      ? `Held before activation. Inspect: skillgate inspect ${report.id}\nDecide later: skillgate approve ${report.id}`
      : '',
  ].filter(Boolean).join('\n');
}
