/**
 * Complete Example Test - Playwright EasyScale
 * 
 * This is a comprehensive example showing how to write tests for distributed execution.
 * All configuration is baked into the test file - no external env vars needed!
 * 
 * HOW IT WORKS:
 * 1. The orchestrator sets USER_RANGE_START and USER_RANGE_END for each container
 * 2. This test reads those values and creates tests for that user range
 * 3. Each container runs its assigned users in parallel
 * 
 * CUSTOMIZE THIS FILE:
 * - Change the test scenario below to match your application
 * - Modify the config object with your app's URLs and credentials
 * - Add more test steps as needed
 * - Adjust parallel execution settings
 */

const { test, expect } = require('@playwright/test');
const { loadTestParameters } = require('../helpers/parameterLoader');

// ============================================================================
// LOAD PARAMETERS FROM METADATA FORM
// ============================================================================

let CONFIG = {
  // Default values (will be overridden by metadata if provided)
  loginUrl: process.env.TEST_APP_URL,
  dashboardUrl: null, // Will be constructed from loginUrl
  password: 'test-password-123',
  emailPattern: (userId) => `testuser${userId}@example.com`,
  headless: true,
  timeout: 30000,
  testSteps: {
    login: true,
    navigateDashboard: true,
    performAction: true,
    logout: false
  }
};

// Load parameters from S3 (set by the UI form)
(async () => {
  try {
    const params = await loadTestParameters();
    
    // Override with form parameters if provided
    if (params.loginUrl) {
      CONFIG.loginUrl = params.loginUrl.startsWith('http') 
        ? params.loginUrl 
        : `https://${params.loginUrl}`;
    }
    
    if (params.password) {
      CONFIG.password = params.password;
    }
    
    // Construct dashboard URL from login URL
    CONFIG.dashboardUrl = CONFIG.loginUrl.replace(/\/$/, '') + '/dashboard.html';
    
    console.log(`\n📝 Test configuration loaded:`);
    console.log(`   - Login URL: ${CONFIG.loginUrl}`);
    console.log(`   - Dashboard URL: ${CONFIG.dashboardUrl}`);
    console.log(`   - Headless: ${CONFIG.headless}`);
    console.log(`   - Timeout: ${CONFIG.timeout}ms`);
  } catch (error) {
    console.error('Error loading parameters, using defaults:', error);
  }
})();

// ============================================================================
// DISTRIBUTED EXECUTION SETUP
// ============================================================================

// Read user range from environment (set by orchestrator)
const userRangeStart = parseInt(process.env.USER_RANGE_START || '1');
const userRangeEnd = parseInt(process.env.USER_RANGE_END || '1');

console.log(`\n🚀 Container starting: Users ${userRangeStart} to ${userRangeEnd}`);
console.log(`📊 Total users in this container: ${userRangeEnd - userRangeStart + 1}\n`);

// ============================================================================
// TEST SUITE - One test per user
// ============================================================================

for (let userId = userRangeStart; userId <= userRangeEnd; userId++) {
  test(`User ${userId} - Complete workflow`, async ({ page }) => {
    const email = CONFIG.emailPattern(userId);
    
    console.log(`[User ${userId}] Starting test with email: ${email}`);

    // ========================================================================
    // STEP 1: Login
    // ========================================================================
    if (CONFIG.testSteps.login) {
      console.log(`[User ${userId}] Navigating to login page...`);
      await page.goto(CONFIG.loginUrl, { timeout: CONFIG.timeout });

      console.log(`[User ${userId}] Filling login form...`);
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', CONFIG.password);
      
      console.log(`[User ${userId}] Submitting login...`);
      await page.click('button[type="submit"]');

      // Wait for navigation after login
      await page.waitForLoadState('networkidle', { timeout: CONFIG.timeout });
      
      console.log(`[User ${userId}] ✓ Login successful`);
    }

    // ========================================================================
    // STEP 2: Navigate to Dashboard
    // ========================================================================
    if (CONFIG.testSteps.navigateDashboard) {
      console.log(`[User ${userId}] Navigating to dashboard...`);
      await page.goto(CONFIG.dashboardUrl, { timeout: CONFIG.timeout });

      // Verify we're on the dashboard
      await expect(page).toHaveURL(/dashboard|home/, { timeout: CONFIG.timeout });
      
      console.log(`[User ${userId}] ✓ Dashboard loaded`);
    }

    // ========================================================================
    // STEP 3: Perform Application-Specific Action
    // ========================================================================
    if (CONFIG.testSteps.performAction) {
      console.log(`[User ${userId}] Performing test action...`);
      
      // Example: Click a button, fill a form, etc.
      // Customize this section for your application!
      
      // Example 1: Check if a specific element exists
      const welcomeMessage = page.locator('h1, .welcome-message');
      await expect(welcomeMessage).toBeVisible({ timeout: CONFIG.timeout });
      
      // Example 2: Interact with a button
      // await page.click('button#start-action');
      // await page.waitForSelector('.action-complete', { timeout: CONFIG.timeout });
      
      // Example 3: Fill out a form
      // await page.fill('input[name="task"]', `Task from user ${userId}`);
      // await page.click('button[type="submit"]');
      
      console.log(`[User ${userId}] ✓ Action completed`);
    }

    // ========================================================================
    // STEP 4: Logout (Optional)
    // ========================================================================
    if (CONFIG.testSteps.logout) {
      console.log(`[User ${userId}] Logging out...`);
      await page.click('button#logout, a[href*="logout"]');
      await page.waitForURL(/login|signin/, { timeout: CONFIG.timeout });
      console.log(`[User ${userId}] ✓ Logout successful`);
    }

    // ========================================================================
    // TEST COMPLETE
    // ========================================================================
    console.log(`[User ${userId}] ✅ Test completed successfully!\n`);
  });
}

// ============================================================================
// PLAYWRIGHT CONFIGURATION (per-container settings)
// ============================================================================

// These settings apply to all tests in this container
test.use({
  headless: CONFIG.headless,
  viewport: { width: 1280, height: 720 },
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure'
});

// Set default timeout
test.setTimeout(CONFIG.timeout);
