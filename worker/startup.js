/**
 * Worker Startup Script
 * Reports readiness to S3 and waits for start command before running tests
 */

const { updateState, waitForCommand, clearCommand } = require('./state-manager');

const WORKER_INDEX = parseInt(process.env.SHARD_INDEX || '1');
const USER_RANGE_START = parseInt(process.env.USER_RANGE_START || '1');
const USER_RANGE_END = parseInt(process.env.USER_RANGE_END || '1');

/**
 * Report worker readiness
 */
async function reportReady() {
  try {
    console.log(`[Worker ${WORKER_INDEX}] Reporting ready state...`);
    
    await updateState('ready', {
      index: WORKER_INDEX,
      startUser: USER_RANGE_START,
      endUser: USER_RANGE_END,
      userCount: USER_RANGE_END - USER_RANGE_START + 1,
      command: null,
      readyAt: new Date().toISOString()
    });
    
    console.log(`[Worker ${WORKER_INDEX}] ✓ Ready state reported`);
    return true;
  } catch (error) {
    console.error(`[Worker ${WORKER_INDEX}] Failed to report ready state:`, error);
    return false;
  }
}

/**
 * Main startup sequence
 */
async function main() {
  console.log(`\n========================================`);
  console.log(`Worker ${WORKER_INDEX} Startup`);
  console.log(`========================================`);
  console.log(`Run ID: ${process.env.RUN_ID}`);
  console.log(`User Range: ${USER_RANGE_START}-${USER_RANGE_END}`);
  console.log(`========================================\n`);
  
  // Step 1: Report ready
  const readyReported = await reportReady();
  if (!readyReported) {
    console.error('Failed to report ready state. Exiting.');
    process.exit(1);
  }
  
  // Step 2: Wait for start command
  const startCommandReceived = await waitForCommand('start');
  if (!startCommandReceived) {
    console.error('Failed to receive start command. Exiting.');
    process.exit(1);
  }
  
  // Step 3: Clear command and update state to testing
  await clearCommand();
  await updateState('testing', {
    testingStartedAt: new Date().toISOString()
  });
  
  console.log(`[Worker ${WORKER_INDEX}] ✓ State updated to 'testing'`);
  console.log(`[Worker ${WORKER_INDEX}] Starting test execution...\n`);
  console.log(`========================================`);
  console.log(`STARTUP.JS COMPLETED - Handing off to Playwright`);
  console.log(`========================================\n`);
  
  // Exit successfully - command-monitor and Playwright tests will run next
  process.exit(0);
}

// Run startup sequence
main().catch(error => {
  console.error('Startup failed:', error);
  process.exit(1);
});
