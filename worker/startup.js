/**
 * Worker Startup Script
 * Reports readiness to S3 and waits for start signal before running tests
 */

const { uploadJSON, downloadJSON } = require('@playwright-easyscale/shared/s3Operations');
const { getWorkerStatusPath, getRunControlPath } = require('@playwright-easyscale/shared/storagePaths');

const RUN_ID = process.env.RUN_ID;
const WORKER_INDEX = parseInt(process.env.SHARD_INDEX || '1');
const USER_RANGE_START = parseInt(process.env.USER_RANGE_START || '1');
const USER_RANGE_END = parseInt(process.env.USER_RANGE_END || '1');

const storageConfig = {
  endpoint: process.env.S3_ENDPOINT,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION || 'auto'
};

/**
 * Report worker readiness to S3
 */
async function reportReady() {
  try {
    console.log(`[Worker ${WORKER_INDEX}] Reporting ready status to S3...`);
    
    const status = {
      index: WORKER_INDEX,
      startUser: USER_RANGE_START,
      endUser: USER_RANGE_END,
      userCount: USER_RANGE_END - USER_RANGE_START + 1,
      status: 'ready',
      readyAt: new Date().toISOString()
    };
    
    await uploadJSON(
      storageConfig,
      getWorkerStatusPath(RUN_ID, WORKER_INDEX),
      status
    );
    
    console.log(`[Worker ${WORKER_INDEX}] ✓ Ready status reported`);
    return true;
  } catch (error) {
    console.error(`[Worker ${WORKER_INDEX}] Failed to report ready status:`, error);
    return false;
  }
}

/**
 * Wait for start signal from orchestrator
 */
async function waitForStartSignal() {
  console.log(`[Worker ${WORKER_INDEX}] Waiting for start signal...`);
  
  const pollInterval = 2000; // 2 seconds
  const maxWaitTime = 600000; // 10 minutes
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const control = await downloadJSON(
        storageConfig,
        getRunControlPath(RUN_ID)
      );
      
      if (control && control.signal === 'start') {
        console.log(`[Worker ${WORKER_INDEX}] ✓ Start signal received!`);
        return true;
      }
    } catch (error) {
      // Control file doesn't exist yet, keep waiting
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.error(`[Worker ${WORKER_INDEX}] Timeout waiting for start signal`);
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
 * Main startup sequence
 */
async function main() {
  console.log(`\n========================================`);
  console.log(`Worker ${WORKER_INDEX} Startup`);
  console.log(`========================================`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log(`User Range: ${USER_RANGE_START}-${USER_RANGE_END}`);
  console.log(`========================================\n`);
  
  // Step 1: Report ready
  const readyReported = await reportReady();
  if (!readyReported) {
    console.error('Failed to report ready status. Exiting.');
    process.exit(1);
  }
  
  // Step 2: Wait for start signal
  const startSignalReceived = await waitForStartSignal();
  if (!startSignalReceived) {
    console.error('Failed to receive start signal. Exiting.');
    process.exit(1);
  }
  
  // Step 3: Update status to running
  await updateStatus('running');
  
  console.log(`[Worker ${WORKER_INDEX}] ✓ Status updated to 'running'`);
  console.log(`[Worker ${WORKER_INDEX}] Starting test execution...\n`);
  console.log(`========================================`);
  console.log(`STARTUP.JS COMPLETED - Handing off to Playwright`);
  console.log(`========================================\n`);
  
  // Exit successfully - stop-monitor and Playwright tests will run next
  process.exit(0);
}

// Run startup sequence
main().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});
