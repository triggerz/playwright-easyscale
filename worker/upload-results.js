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
      status: 'completed'
    };

    console.log('📝 Uploading summary...');
    await uploadTestResults(runId, shardIndex, summary, storageConfig);

    console.log('\n✅ All results uploaded successfully!\n');
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
