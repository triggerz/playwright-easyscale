#!/usr/bin/env node

/**
 * Post-test script to upload logs and results to storage
 * This runs after Playwright tests complete
 */

const { uploadLogs, uploadScreenshots, uploadTestResults } = require('./helpers/logUpload');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n📤 Uploading test results...\n');

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

    console.log('\n✅ All results uploaded successfully!\n');
    console.log(`📊 Test Results: ${testStats.passed} passed, ${testStats.failed} failed, ${testStats.total} total\n`);
    
    // Update worker status to completed (or failed if any tests failed)
    const finalStatus = testStats.failed > 0 ? 'completed-with-failures' : 'completed';
    await updateWorkerStatus(finalStatus, testStats);
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error(error.stack);
    
    // Update worker status to failed
    await updateWorkerStatus('failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Parse Playwright test results from JSON reporter output
 */
function parsePlaywrightResults() {
  try {
    const resultsPath = path.join(__dirname, 'test-results', '.last-run.json');
    
    // Try to read Playwright's JSON results
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      return {
        total: results.stats?.expected || 0,
        passed: results.stats?.expected || 0,
        failed: results.stats?.unexpected || 0,
        skipped: results.stats?.skipped || 0
      };
    }
    
    // Fallback: count test result directories
    const testResultsPath = path.join(__dirname, 'test-results');
    if (fs.existsSync(testResultsPath)) {
      const dirs = fs.readdirSync(testResultsPath).filter(f => {
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
    console.warn('Could not parse test results:', error.message);
  }
  
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };
}

/**
 * Update worker status in S3
 */
async function updateWorkerStatus(status, additionalData = {}) {
  try {
    const { uploadJSON, downloadJSON } = require('@playwright-easyscale/shared/s3Operations');
    const { getWorkerStatusPath } = require('@playwright-easyscale/shared/storagePaths');
    
    const runId = process.env.RUN_ID;
    const shardIndex = process.env.SHARD_INDEX || '1';
    const storageConfig = {
      endpoint: process.env.S3_ENDPOINT,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION || 'auto'
    };
    
    // Get current status
    const currentStatus = await downloadJSON(
      storageConfig,
      getWorkerStatusPath(runId, shardIndex)
    );
    
    // Update with new status
    await uploadJSON(
      storageConfig,
      getWorkerStatusPath(runId, shardIndex),
      {
        ...currentStatus,
        status,
        ...additionalData,
        lastUpdated: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }
    );
    
    console.log(`✓ Worker status updated to: ${status}`);
  } catch (error) {
    console.error('Failed to update worker status:', error.message);
  }
}

main();
