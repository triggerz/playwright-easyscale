/**
 * Playwright configuration for distributed testing
 * @see https://playwright.dev/docs/test-configuration
 */

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.RETRIES ? parseInt(process.env.RETRIES) : 0,
  workers: process.env.MAX_CONCURRENCY ? parseInt(process.env.MAX_CONCURRENCY) : 5,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/.last-run.json' }]
  ],
  timeout: process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : 300000,
  use: {
    headless: process.env.HEADLESS !== 'false',
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium'
      }
    }
  ]
});
