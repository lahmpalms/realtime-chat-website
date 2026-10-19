import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  projects: (process.env.CHAT_CROSS_BROWSER === 'true' ? ['chromium', 'firefox', 'webkit'] : ['chromium'])
    .map(name => ({ name, use: { browserName: name } })),
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: { baseURL: 'http://127.0.0.1:3189', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/test-web.mjs', url: 'http://127.0.0.1:3189', timeout: 240_000, reuseExistingServer: false },
});
