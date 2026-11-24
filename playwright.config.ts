import { defineConfig, devices } from '@playwright/test';

const PORT = 4317;

// End-to-end tests: the built app on the real server, with a small library of its own
// (e2e/library.json), never data/. `npm run e2e`; see e2e/serve.ts.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  // One library on disk, shared by the tests: they run one at a time and each starts it afresh.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node e2e/serve.ts',
    url: `http://localhost:${PORT}/api/health`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
