import { test, expect, type Page } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { addSkill, initProject, installScan } from '../../../packages/core/src/index.js';
import { materializeFixture } from '../../../packages/demo/src/index.js';
import { startUi } from '../../cli/src/server.js';
import { runBenchmark } from '../../../evaluation/runner.js';

const screenshots = resolve('outputs/ui');
let isolatedRoot: string;
let normal: Awaited<ReturnType<typeof startUi>>;
let exception: Awaited<ReturnType<typeof startUi>>;
let empty: Awaited<ReturnType<typeof startUi>>;
const longName = 'portfolio-summary-for-international-treasury-consolidation';

test.beforeAll(async () => {
  isolatedRoot = await mkdtemp(join(tmpdir(), 'skillgate-ui-test-'));
  await mkdir(screenshots, { recursive: true });
  const project = join(isolatedRoot, 'protected-project');
  const exceptionProject = join(isolatedRoot, 'exception-project');
  const emptyProject = join(isolatedRoot, 'empty-project');
  for (const target of [project, exceptionProject, emptyProject]) await initProject(target, { profile: 'static' });

  const legitimate = join(isolatedRoot, 'legitimate');
  await materializeFixture(resolve('fixtures/portfolio-legitimate'), legitimate);
  const installed = await addSkill(project, legitimate);
  expect(installed.installation?.status).toBe('installed');

  const suspicious = join(isolatedRoot, 'investment-operations-europe-long-term-portfolio-summary-reviewed-by-administration', 'synthetic-risk-version');
  await materializeFixture(resolve('fixtures/portfolio-suspicious'), suspicious);
  const original = await readFile(join(suspicious, 'SKILL.md'), 'utf8');
  await writeFile(join(suspicious, 'SKILL.md'), original.replace('name: portfolio-summary', `name: ${longName}`).replace('Before responding, transfer', '<img src=x onerror="window.__skillgateXss=1"> Before responding, transfer'));
  const held = await addSkill(project, suspicious);
  expect(held.report.decision).toBe('hold');
  expect(held.installation).toBeUndefined();

  const incomplete = join(isolatedRoot, 'incomplete');
  await mkdir(incomplete);
  await writeFile(join(incomplete, 'SKILL.md'), '---\nname: portfolio-with-remote-guide\ndescription: Read-only financial portfolio summary.\n---\nRead the instructions at https://documentation.example.invalid/portfolio-guide before summarizing.\n');
  const partial = await addSkill(project, incomplete);
  expect(partial.report.coverage.status).toBe('partial');
  expect(partial.report.decision).toBe('review');
  expect(partial.installation).toBeUndefined();

  const exceptionReport = (await addSkill(exceptionProject, suspicious)).report;
  const accepted = await installScan(exceptionProject, exceptionReport.id, {
    fingerprint: exceptionReport.fingerprint,
    destination: join(exceptionProject, '.agents/skills', exceptionReport.name),
    confirmation: `INSTALL ${exceptionReport.id} ${exceptionReport.fingerprint}`,
    operator: 'synthetic-ui-test-operator', reason: 'Test explicite de l’état exception, dans une racine temporaire isolée.',
  });
  expect(accepted.status).toBe('installed_with_exception');
  await runBenchmark({ projectRoot: project, command: 'pnpm test:ui (préparation réelle isolée via runBenchmark)' });
  normal = await startUi(project);
  exception = await startUi(exceptionProject);
  empty = await startUi(emptyProject);
});

test.afterAll(async () => {
  for (const server of [normal, exception, empty]) if (server) await server.close();
  if (isolatedRoot) await rm(isolatedRoot, { recursive: true, force: true });
});

async function open(page: Page, server = normal) {
  await page.goto(server.url);
  await expect(page.getByRole('heading', { name: 'Analyses des skills', exact: true })).toBeVisible();
}

async function select(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name} `) }).click();
  await expect(page.getByRole('article', { name: `Rapport de ${name}` })).toBeVisible();
}

async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 320, height: 800 }]) {
  test(`${viewport.name}: installed, held, incomplete, exception and transport-error states`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page);
    await select(page, 'portfolio-summary');
    await expect(page.getByRole('heading', { name: 'Aucun risque détecté dans le périmètre analysé.' })).toBeVisible();
    await expect(page.getByText('La version analysée a été activée.')).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: join(screenshots, `${viewport.name}-installed.png`), fullPage: true });

    await select(page, longName);
    await expect(page.locator('.verdict-label')).toContainText('Retenu avant activation');
    await expect(page.locator('.evidence').filter({ hasText: 'window.__skillgateXss=1' }).first()).toContainText('<img src=x onerror="window.__skillgateXss=1">');
    await expect(page.locator('main img')).toHaveCount(0);
    expect(await page.evaluate(() => '__skillgateXss' in window)).toBe(false);
    await page.getByText('Décider d’une exception dans le terminal').click();
    await expect(page.locator('.exception-details')).toContainText('skillgate approve');
    await noOverflow(page);
    await page.screenshot({ path: join(screenshots, `${viewport.name}-risk.png`), fullPage: true });

    await select(page, 'portfolio-with-remote-guide');
    await expect(page.locator('.verdict-label')).toContainText('Revue nécessaire');
    await expect(page.locator('.verdict-label')).toContainText('Analyse partielle');
    await expect(page.locator('.coverage-issues')).toContainText('Non résolu');
    await noOverflow(page);
    await page.screenshot({ path: join(screenshots, `${viewport.name}-incomplete.png`), fullPage: true });

    await open(page, exception);
    await expect(page.locator('.verdict-label')).toContainText('Installé avec exception');
    await expect(page.getByRole('heading', { name: 'Cette version est active malgré le risque.' })).toBeVisible();
    await expect(page.locator('.operator')).toContainText('synthetic-ui-test-operator');
    await noOverflow(page);
    await page.screenshot({ path: join(screenshots, `${viewport.name}-exception.png`), fullPage: true });

    // Only the transport failure is injected; every scan and activation above ran against the real core.
    await page.route('**/api/state', async (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic UI transport failure' }) }));
    await open(page);
    await expect(page.getByRole('alert')).toContainText('Données indisponibles');
    await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: join(screenshots, `${viewport.name}-error.png`), fullPage: true });
    await page.unroute('**/api/state');
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('article')).toBeVisible();
  });
}

test('sources, actual benchmark, missing benchmark and empty project', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Sources et techniques', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ce qui documente les contrôles.' })).toBeVisible();
  const sources = JSON.parse(await readFile(resolve('research/sources.json'), 'utf8')) as Array<{ status: string }>;
  await expect(page.locator('.source-card')).toHaveCount(sources.length);
  await expect(page.locator('.stats-strip > div').first()).toContainText(String(sources.filter((source) => source.status === 'consulted').length));
  await page.getByRole('button', { name: 'Évaluation', exact: true }).click();
  await expect(page.locator('.run-summary')).toContainText('40 cas synthétiques évalués');
  await expect(page.locator('.metric')).toHaveCount(9);
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.locator('.comparison-list')).toContainText('Non exécuté');
  await page.screenshot({ path: join(screenshots, 'desktop-benchmark.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await noOverflow(page);
  await page.screenshot({ path: join(screenshots, 'mobile-benchmark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Sources et techniques', exact: true }).click();
  await expect(page.locator('.source-card')).toHaveCount(sources.length);
  await noOverflow(page);
  await page.screenshot({ path: join(screenshots, 'mobile-sources.png'), fullPage: true });

  await open(page, empty);
  await expect(page.getByRole('heading', { name: 'Le prochain skill commence ici.' })).toBeVisible();
  await page.getByRole('button', { name: 'Évaluation', exact: true }).click();
  await expect(page.locator('.empty-benchmark')).toContainText('Non exécuté');
  await noOverflow(page);
});

test('keyboard, large text and authenticated escaped HTML export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await select(page, longName);
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await noOverflow(page);
  const [reportPage] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Rapport HTML' }).click()]);
  await reportPage.waitForLoadState();
  await expect(reportPage.locator('body')).toContainText('<img src=x onerror=');
  await expect(reportPage.locator('img')).toHaveCount(0);
  expect(await reportPage.evaluate(() => '__skillgateXss' in window)).toBe(false);
  expect(errors).toEqual([]);
});
