import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,   // DB共有のためシリアル実行
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['html', { open: 'never', outputFolder: 'tests/レポート/html' }],
    ['json', { outputFile: 'tests/レポート/playwright-results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
