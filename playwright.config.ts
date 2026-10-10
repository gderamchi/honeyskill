import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: './work/playwright',
  reporter: [['list'], ['json', { outputFile: './outputs/ui/test-results.json' }]],
  use: { browserName: 'chromium', headless: true, trace: 'retain-on-failure' },
});
