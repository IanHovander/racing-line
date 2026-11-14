import { defineConfig } from 'playwright/test';

// Tests run against the production build in dist/ (run `npm run build` first).
// Set CHROME_PATH to use an installed Chrome instead of Playwright's own Chromium.
export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173/',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
  },
});
