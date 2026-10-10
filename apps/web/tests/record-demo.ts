import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { startUi } from '../../cli/src/server.js';
import { listReports } from '../../../packages/core/src/index.js';

const outputs = resolve('outputs');
const sourceFile = resolve(outputs, 'demo.json');
const demo = JSON.parse(await readFile(sourceFile, 'utf8')) as {
  protectedProject: string; mode: string; executedAt: string;
  legitimate: { reportId: string }; update: { reportId: string };
};
const reports = await listReports(demo.protectedProject);
const update = reports.find((report) => report.id === demo.update.reportId);
const legitimate = reports.find((report) => report.id === demo.legitimate.reportId);
if (!update || !legitimate || update.decision !== 'hold' || legitimate.decision !== 'allow') {
  throw new Error('Expected actual held-update and legitimate reports from outputs/demo.json.');
}
await mkdir(resolve('work/ui-recording'), { recursive: true });
const server = await startUi(demo.protectedProject);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: resolve('work/ui-recording'), size: { width: 1440, height: 1000 } },
});
const page = await context.newPage();
const video = page.video();
if (!video) throw new Error('Playwright recording unavailable.');
const startedAt = new Date().toISOString();
const started = performance.now();
const steps: Array<{ elapsedSeconds: number; action: string }> = [];
const step = (action: string) => steps.push({ elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)), action });

try {
  await page.goto(server.url);
  await page.getByRole('heading', { name: 'Analyses des skills', exact: true }).waitFor();
  await page.locator('.report-item').nth(reports.findIndex((report) => report.id === update.id)).click();
  await page.locator('.verdict-label').filter({ hasText: 'Retenu avant activation' }).waitFor();
  step('Vue de la mise à jour suspecte réellement retenue ; ancienne version enregistrée comme active.');
  await page.screenshot({ path: resolve(outputs, 'ui-demo-risk.png') });
  await pause(3000);

  await page.locator('.finding').first().scrollIntoViewIfNeeded();
  step('Preuves financières extraites des fichiers et lignes du snapshot effectivement analysé.');
  await pause(2600);

  await page.locator('.report-item').nth(reports.findIndex((report) => report.id === legitimate.id)).click();
  await page.getByRole('heading', { name: 'Aucun risque détecté dans le périmètre analysé.', exact: true }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  step('Version légitime réellement installée, affichée depuis son rapport.');
  await pause(3000);

  await page.getByRole('button', { name: 'Sources et techniques', exact: true }).click();
  await page.locator('.source-card').first().waitFor();
  step('Sources consultées et techniques documentées provenant des fichiers research réels.');
  await pause(2500);

  await page.getByRole('button', { name: 'Évaluation', exact: true }).click();
  await page.locator('.run-summary').waitFor();
  step('Résultats du benchmark interne synthétique précédemment exécuté, sans comparaison externe inventée.');
  await pause(3000);
} finally {
  await context.close();
  await video.saveAs(resolve(outputs, 'ui-demo.webm'));
  await browser.close();
  await server.close();
}

const durationSeconds = Number(((performance.now() - started) / 1000).toFixed(2));
await writeFile(resolve(outputs, 'ui-demo.provenance.json'), JSON.stringify({
  schemaVersion: 1,
  title: 'Enregistrement de secours : interface locale sur démonstration statique synthétique',
  command: 'pnpm exec tsx apps/web/tests/record-demo.ts',
  startedAt,
  durationSeconds,
  durationMeasurement: 'Temps monotone écoulé du début de navigation à la fermeture et sauvegarde du contexte ; la durée encodée peut légèrement différer.',
  video: 'outputs/ui-demo.webm',
  screenshot: 'outputs/ui-demo-risk.png',
  browser: 'Playwright Chromium',
  viewport: { width: 1440, height: 1000 },
  demoSource: 'outputs/demo.json',
  demoExecutedAt: demo.executedAt,
  demoMode: demo.mode,
  recordedContent: 'Navigation en direct dans l’UI locale lisant les rapports enregistrés d’exécutions réelles du moteur sur des fixtures synthétiques. Aucun verdict ni résultat remplacé pour la vidéo.',
  limitations: [
    'Enregistrement de secours, pas une exécution de modèle ni un transfert financier réel.',
    'Les scans et installations ont été exécutés auparavant par la démonstration isolée ; ils ne sont pas relancés pendant la capture.',
    'Le benchmark affiché est interne et synthétique ; les mesures exactes restent dans outputs/benchmark.json.',
    'Aucun appel à un fournisseur payé, aucun secret ou wallet réel, aucune publication.',
  ],
  reports: [update, legitimate].map(({ id, fingerprint, decision, profile, engineVersion, rulesVersion }) => ({ id, fingerprint, decision, profile, engineVersion, rulesVersion })),
  steps,
}, null, 2) + '\n');
console.log(JSON.stringify({ video: 'outputs/ui-demo.webm', durationSeconds, steps: steps.length }));
