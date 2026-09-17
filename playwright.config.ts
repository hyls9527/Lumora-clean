import { defineConfig, devices } from '@playwright/test';

// Production-build performance measurement: `vite preview` serves the same
// bundle users download, so bundle size, minification and chunk splitting are
// real. The dev server transforms modules on demand, which inflated measured
// page load by an order of magnitude.
const PERF_PORT = 4173;
const DEV_PORT = 1420;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:' + DEV_PORT,
    // Windows dev machines use Edge; CI (ubuntu) has no msedge channel, so
    // the workflow sets PLAYWRIGHT_CHANNEL=chromium (C-5).
    channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'core',
      testMatch: /core\.spec\.ts/,
      // Two workers: the dev server transforms modules on demand, so 6
      // concurrent page loads starve each other and every navigation hits the
      // 15s expect timeout. Measured: 6 workers → 5 failures, 2 → 5 passes.
      workers: 2,
      use: { baseURL: 'http://localhost:' + DEV_PORT },
    },
    {
      // Overlap two page loads on one dev server and the measured time is
      // contention, not the app: perf specs run serially on their own server.
      name: 'perf',
      testMatch: /perf-.*\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
        baseURL: 'http://localhost:' + PERF_PORT,
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:' + DEV_PORT,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Build first, then serve the production bundle for the perf project.
      command:
        'npm run build:perf && npm run preview -- --port ' + PERF_PORT + ' --strictPort',
      url: 'http://localhost:' + PERF_PORT,
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
