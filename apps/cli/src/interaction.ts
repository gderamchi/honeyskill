import { createInterface } from 'node:readline';
import type { InstallRecord, ScanReport } from '../../../packages/contracts/src/index.js';

export function question(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve, reject) => {
    let answered = false;
    rl.once('close', () => {
      if (!answered) reject(Object.assign(new Error('Installation annulée.'), { exitCode: 130 }));
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
    ? 'Installé avec exception. Les risques signalés restent présents.'
    : installation ? 'Installé automatiquement. Aucun risque détecté dans le périmètre analysé.'
    : report.decision === 'allow' ? 'Aucun risque détecté dans le périmètre analysé.'
    : report.findings[0]?.financialConsequence ?? 'Analyse incomplète : installation suspendue.';
  const evidence = report.findings.map(finding =>
    `${finding.category} · ${finding.severity} — ${finding.explanation}\nRisque : ${finding.financialConsequence}\n${finding.evidence.map(item => `  ${item.file}:${item.line} ${item.excerpt}`).join('\n')}`
  ).join('\n');
  return [
    headline,
    `${report.name} · ${report.profile === 'static' ? 'Analyse statique' : 'Analyse hybride'} · ${report.coverage.status}`,
    evidence,
    ...report.coverage.errors,
    ...report.coverage.limitsReached,
    `Rapport : ${report.id}`,
    `Empreinte : ${report.fingerprint}`,
    !installation && report.decision !== 'allow'
      ? `Retenu avant activation. Examiner : skillgate inspect ${report.id}\nDécider plus tard : skillgate approve ${report.id}`
      : '',
  ].filter(Boolean).join('\n');
}
