#!/usr/bin/env node

/**
 * Post-test script to upload logs and results to storage
 * This runs after Playwright tests complete
 * 
 * Can be used as standalone script or imported as module
 */

const { uploadLogs, uploadScreenshots, uploadTestResults } = require('./helpers/logUpload');
const { createLogger } = require('@playwright-easyscale/shared/logger');
const fs = require('fs');
const path = require('path');

/**
 * Upload all results (logs, screenshots, summary)
 * Can be called from index.js or run standalone
 */
async function uploadAllResults() {
  console.log('\n========================================');
  console.log('📤 UPLOAD-RESULTS.JS STARTED');
  console.log(`Worker ${process.env.SHARD_INDEX || '1'} - Run ${process.env.RUN_ID}`);
  console.log('========================================\n');

  // Get environment variables
  const runId = process.env.RUN_ID;
  const shardIndex = process.env.SHARD_INDEX || '1';
  const storageConfig = {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'auto'
  };

  // Validate configuration
  if (!runId) {
    console.error('❌ RUN_ID environment variable not set');
    process.exit(1);
  }

  if (!storageConfig.endpoint || !storageConfig.accessKey || !storageConfig.secretKey || !storageConfig.bucket) {
    console.error('❌ Storage configuration incomplete');
    console.error('   Required: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET');
    process.exit(1);
  }

  try {
    // Parse Playwright test results to get pass/fail counts
    const testStats = parsePlaywrightResults();
    
    // Upload Playwright test results
    const testResultsPath = path.join(__dirname, 'test-results');
    if (fs.existsSync(testResultsPath)) {
      console.log('📊 Uploading test results...');
      await uploadLogs(runId, shardIndex, testResultsPath, storageConfig);
    }

    // Upload screenshots
    const screenshotsPath = path.join(__dirname, 'test-results');
    if (fs.existsSync(screenshotsPath)) {
      console.log('📸 Uploading screenshots...');
      await uploadScreenshots(runId, shardIndex, screenshotsPath, storageConfig);
    }

    // Create and upload summary
    const summary = {
      runId,
      shardIndex,
      timestamp: new Date().toISOString(),
      userRangeStart: process.env.USER_RANGE_START,
      userRangeEnd: process.env.USER_RANGE_END,
      status: 'completed',
      ...testStats
    };

    console.log('📝 Uploading summary...');
    await uploadTestResults(runId, shardIndex, summary, storageConfig);

    console.log('\n✅ All results uploaded successfully!');
    console.log(`📊 Test Results: ${testStats.passed} passed, ${testStats.failed} failed, ${testStats.total} total`);
    
    // Log worker finished to both console and S3
    const logger = createLogger(null, null, { workerIndex: parseInt(shardIndex) });
    await logger.success(`Worker ${shardIndex} finished`, {
      event: 'worker_finished',
      passed: testStats.passed,
      failed: testStats.failed,
      total: testStats.total,
      skipped: testStats.skipped,
      userRangeStart: process.env.USER_RANGE_START,
      userRangeEnd: process.env.USER_RANGE_END
    });
    
    // Check if we were stopped, otherwise mark as finished
    const { readState, updateState } = require('./state-manager');
    const currentState = await readState();
    
    let finalState;
    if (currentState && currentState.state === 'stopped') {
      // Already stopped, don't overwrite
      finalState = 'stopped';
      console.log(`\n✓ Worker already in 'stopped' state, preserving it`);
    } else {
      // Mark as finished
      finalState = 'finished';
      console.log(`\n🔄 Updating worker state to: ${finalState}`);
      await updateState(finalState, {
        ...testStats,
        finishedAt: new Date().toISOString()
      });
    }
    
    console.log('\n========================================');
    console.log('✅ UPLOAD-RESULTS.JS COMPLETED');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error(error.stack);
    
    // Update worker status to failed
    try {
      const { updateState } = require('./state-manager');
      await updateState('failed', { error: error.message });
    } catch (stateError) {
      console.error('Failed to update state:', stateError.message);
    }
    
    process.exit(1);
  }
}

/**
 * Parse Playwright test results from JSON reporter output
 */
function parsePlaywrightResults() {
  try {
    const resultsPath = path.join(__dirname, 'test-results', 'results.json');
    
    // Try to read Playwright's JSON results
    if (fs.existsSync(resultsPath)) {
      const fileContent = fs.readFileSync(resultsPath, 'utf8');
      const results = JSON.parse(fileContent);
      
      // Count test results from suites
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      
      if (results.suites) {
        const countTests = (suites) => {
          for (const suite of suites) {
            if (suite.specs) {
              for (const spec of suite.specs) {
                if (spec.ok) {
                  passed++;
                } else {
                  failed++;
                }
              }
            }
            if (suite.suites) {
              countTests(suite.suites);
            }
          }
        };
        countTests(results.suites);
      }
      
      const total = passed + failed + skipped;
      
      return {
        total,
        passed,
        failed,
        skipped
      };
    }
    
    // Fallback: count test result directories
    const testResultsPath = path.join(__dirname, 'test-results');
    if (fs.existsSync(testResultsPath)) {
      const allItems = fs.readdirSync(testResultsPath);
      const dirs = allItems.filter(f => {
        const fullPath = path.join(testResultsPath, f);
        return fs.statSync(fullPath).isDirectory();
      });
      
      const failed = dirs.filter(d => d.includes('failed')).length;
      const total = dirs.length;
      
      return {
        total,
        passed: total - failed,
        failed,
        skipped: 0
      };
    }
  } catch (error) {
    console.error('Error parsing test results:', error.message);
  }
  
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };
}


/**
 * Main function for standalone execution
 */
async function main() {
  await uploadAllResults();
}

// Export for use as module
module.exports = {
  uploadAllResults,
  parsePlaywrightResults
};

// Run as standalone script if executed directly
if (require.main === module) {
  main();
}
