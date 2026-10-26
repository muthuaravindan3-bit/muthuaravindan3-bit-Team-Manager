import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174', channel: 'msedge', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config vite.e2e.config.ts', url: 'http://127.0.0.1:4174', reuseExistingServer: false, timeout: 60000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'artifacts/verification/playwright.json' }]],
});
