#!/usr/bin/env node

/**
 * Background Stop Signal Monitor
 * Runs in parallel with Playwright tests to detect stop signals
 */

const { downloadJSON, uploadJSON } = require('@playwright-easyscale/shared/s3Operations');
const { getRunControlPath, getWorkerStatusPath } = require('@playwright-easyscale/shared/storagePaths');

const RUN_ID = process.env.RUN_ID;
const WORKER_INDEX = parseInt(process.env.SHARD_INDEX || '1');

const storageConfig = {
  endpoint: process.env.S3_ENDPOINT,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION || 'auto'
};

/**
 * Check for stop signal
 */
async function checkForStopSignal() {
  try {
    const control = await downloadJSON(
      storageConfig,
      getRunControlPath(RUN_ID)
    );
    
    if (control && control.signal === 'stop') {
      return true;
    }
  } catch (error) {
    // Control file doesn't exist or no stop signal yet
  }
  return false;
}

/**
 * Update worker status
 */
async function updateStatus(status) {
  try {
    const currentStatus = await downloadJSON(
      storageConfig,
      getWorkerStatusPath(RUN_ID, WORKER_INDEX)
    );
    
    await uploadJSON(
      storageConfig,
      getWorkerStatusPath(RUN_ID, WORKER_INDEX),
      {
        ...currentStatus,
        status,
        lastUpdated: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error(`[Worker ${WORKER_INDEX}] Failed to update status:`, error);
  }
}

/**
 * Monitor for stop signal
 */
async function monitor() {
  const checkInterval = 5000; // Check every 5 seconds
  
  console.log(`[Stop Monitor ${WORKER_INDEX}] Started monitoring for stop signal...`);
  
  const intervalId = setInterval(async () => {
    const shouldStop = await checkForStopSignal();
    if (shouldStop) {
      console.log(`[Stop Monitor ${WORKER_INDEX}] ⚠️ Stop signal received!`);
      console.log(`[Stop Monitor ${WORKER_INDEX}] Stopping test execution...`);
      await updateStatus('stopping');
      clearInterval(intervalId);
      
      // Kill the parent process (Playwright tests)
      process.kill(process.ppid, 'SIGTERM');
      process.exit(0);
    }
  }, checkInterval);
}

// Start monitoring
monitor().catch(error => {
  console.error('Stop monitor failed:', error);
  process.exit(1);
});
