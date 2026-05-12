/**
 * Example Playwright test demonstrating distributed testing
 * This test reads USER_RANGE_START and USER_RANGE_END from environment variables
 * and creates a test for each user in that range
 */

const { test, expect } = require('@playwright/test');

const userRangeStart = parseInt(process.env.USER_RANGE_START || '1');
const userRangeEnd = parseInt(process.env.USER_RANGE_END || '1');

// Hardcoded test app URL - update this to your deployed test-app URL
// For local testing: http://localhost:8080
// For Railway: https://your-test-app.up.railway.app
const loginUrl = process.env.TEST_APP_URL || 'https://test-app-production.up.railway.app';
const password = 'password123';

console.log(`Running tests for users ${userRangeStart} to ${userRangeEnd}`);

for (let userId = userRangeStart; userId <= userRangeEnd; userId++) {
  test(`User ${userId} - Login and navigate`, async ({ page }) => {
    const email = `user${userId}@example.com`;

    console.log(`[User ${userId}] Starting test`);

    await page.goto(loginUrl);

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard|home/);

    console.log(`[User ${userId}] Test completed successfully`);
  });
}
