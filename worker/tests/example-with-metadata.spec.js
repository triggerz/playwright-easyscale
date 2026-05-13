/**
 * @test-metadata
 * {
 *   "name": "Login Stress Test",
 *   "description": "Simulates concurrent user logins with configurable credentials",
 *   "parameters": [
 *     {
 *       "key": "loginUrl",
 *       "label": "Login URL",
 *       "type": "url",
 *       "default": "https://example.com/login",
 *       "description": "The URL of the login page",
 *       "required": true
 *     },
 *     {
 *       "key": "credentials",
 *       "label": "User Credentials",
 *       "type": "array",
 *       "description": "Array of email/password pairs for test users",
 *       "required": false
 *     }
 *   ]
 * }
 */

const { test, expect } = require('@playwright/test');
const { loadParametersForUser } = require('../helpers/parameterLoader');

// Read user range from environment (set by orchestrator)
const userRangeStart = parseInt(process.env.USER_RANGE_START || '1');
const userRangeEnd = parseInt(process.env.USER_RANGE_END || '1');

console.log(`\n🚀 Container starting: Users ${userRangeStart} to ${userRangeEnd}`);
console.log(`📊 Total users in this container: ${userRangeEnd - userRangeStart + 1}\n`);

// Create a test for each user in the range
for (let userId = userRangeStart; userId <= userRangeEnd; userId++) {
  test(`User ${userId} - Login workflow`, async ({ page }) => {
    // Load parameters for this specific user from S3
    const params = await loadParametersForUser(userId);
    
    // Use parameters from form
    let loginUrl = params.loginUrl || process.env.TEST_APP_URL;
    
    // Add https:// if not present
    if (loginUrl && !loginUrl.startsWith('http')) {
      loginUrl = `https://${loginUrl}`;
    }
    
    const credentials = params.credentials || {};
    const email = credentials.email || `user${userId}@example.com`;
    const password = credentials.password || 'password123';

    console.log(`[User ${userId}] Starting test with email: ${email}`);
    console.log(`[User ${userId}] Login URL: ${loginUrl}`);

    // Navigate to login page
    await page.goto(loginUrl, { timeout: 30000 });

    // Fill login form
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    
    // Submit login
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Verify we're logged in (check for dashboard or home page)
    await expect(page).toHaveURL(/dashboard|home/, { timeout: 30000 });

    console.log(`[User ${userId}] ✅ Test completed successfully!\n`);
  });
}

// Configure test behavior
test.use({
  headless: true,
  viewport: { width: 1280, height: 720 },
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

test.setTimeout(60000); // 60 seconds per test
