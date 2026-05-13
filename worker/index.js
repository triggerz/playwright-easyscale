#!/usr/bin/env node

/**
 * Centralized Worker Service
 * 
 * Single entry point that manages the complete worker lifecycle:
 * 1. Report ready state
 * 2. Wait for start command
 * 3. Spawn Playwright tests
 * 4. Monitor for stop command
 * 5. Upload results
 * 6. Report finished/stopped state
 */

const { spawn } = require('child_process');
const { updateState, waitForCommand, clearCommand, pollForCommand } = require('./state-manager');
const { uploadAllResults } = require('./upload-results');

const WORKER_INDEX = parseInt(process.env.SHARD_INDEX || '1');
const USER_RANGE_START = parseInt(process.env.USER_RANGE_START || '1');
const USER_RANGE_END = parseInt(process.env.USER_RANGE_END || '1');
const MAX_TEST_DURATION = parseInt(process.env.MAX_TEST_DURATION || 1800000); // 30 minutes default

let playwrightProcess = null;
let stopRequested = false;
let commandPollInterval = null;

/**
 * Kill process tree (parent + all children)
 */
function killProcessTree(pid) {
  if (!pid) return;
  
  try {
    console.log(`[Worker ${WORKER_INDEX}] Killing process tree for PID ${pid}...`);
    
    if (process.platform === 'win32') {
      // Windows: Use taskkill to kill process tree
      spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
    } else {
      // Unix: Kill process group (negative PID)
      process.kill(-pid, 'SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch (err) {
          // Process already dead, ignore
        }
      }, 5000);
    }
  } catch (error) {
    console.error(`[Worker ${WORKER_INDEX}] Error killing process tree:`, error.message);
  }
}

/**
 * Monitor for stop command while tests are running
 */
async function monitorForStopCommand() {
  return new Promise((resolve) => {
    commandPollInterval = setInterval(async () => {
      try {
        const state = await require('./state-manager').readState();
        
        if (state && state.command === 'stop') {
          console.log(`\n[Worker ${WORKER_INDEX}] ⚠️  STOP COMMAND RECEIVED`);
          stopRequested = true;
          
          // Clear the command
          await clearCommand();
          
          // Update state to stopped
          await updateState('stopped', {
            stoppedAt: new Date().toISOString()
          });
          
          // Kill Playwright process
          if (playwrightProcess) {
            killProcessTree(playwrightProcess.pid);
          }
          
          // Stop polling
          if (commandPollInterval) {
            clearInterval(commandPollInterval);
            commandPollInterval = null;
          }
          
          resolve('stopped');
        }
      } catch (error) {
        console.error(`[Worker ${WORKER_INDEX}] Error checking for stop command:`, error.message);
      }
    }, 2000); // Poll every 2 seconds
  });
}

/**
 * Run Playwright tests
 */
async function runPlaywrightTests() {
  return new Promise((resolve, reject) => {
    console.log(`\n[Worker ${WORKER_INDEX}] 🎭 Starting Playwright tests...`);
    console.log(`[Worker ${WORKER_INDEX}] User range: ${USER_RANGE_START}-${USER_RANGE_END}`);
    
    // Get test file from environment (default to example-with-metadata.spec.js)
    const testFile = process.env.TEST_FILE || 'example-with-metadata.spec.js';
    console.log(`[Worker ${WORKER_INDEX}] Test file: ${testFile}`);
    
    // Spawn Playwright as child process with specific test file
    playwrightProcess = spawn('npx', ['playwright', 'test', `tests/${testFile}`], {
      stdio: 'inherit', // Show Playwright output in real-time
      env: process.env,
      detached: process.platform !== 'win32' // Create process group on Unix
    });
    
    // Handle process exit
    playwrightProcess.on('exit', (code, signal) => {
      console.log(`\n[Worker ${WORKER_INDEX}] Playwright process exited with code ${code}, signal ${signal}`);
      playwrightProcess = null;
      
      if (stopRequested) {
        resolve({ status: 'stopped', code });
      } else if (code === 0) {
        resolve({ status: 'completed', code });
      } else {
        resolve({ status: 'failed', code });
      }
    });
    
    // Handle process errors
    playwrightProcess.on('error', (error) => {
      console.error(`\n[Worker ${WORKER_INDEX}] Playwright process error:`, error);
      playwrightProcess = null;
      reject(error);
    });
    
    // Set maximum test duration timeout
    const timeoutId = setTimeout(() => {
      console.error(`\n[Worker ${WORKER_INDEX}] ⏱️  Test timeout reached (${MAX_TEST_DURATION}ms)`);
      if (playwrightProcess) {
        killProcessTree(playwrightProcess.pid);
      }
      resolve({ status: 'timeout', code: -1 });
    }, MAX_TEST_DURATION);
    
    // Clear timeout when process exits
    playwrightProcess.on('exit', () => {
      clearTimeout(timeoutId);
    });
  });
}

/**
 * Report worker readiness
 */
async function reportReady() {
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
}

/**
 * Main worker lifecycle
 */
async function main() {
  console.log(`\n========================================`);
  console.log(`Worker ${WORKER_INDEX} - Centralized Service`);
  console.log(`========================================`);
  console.log(`Run ID: ${process.env.RUN_ID}`);
  console.log(`User Range: ${USER_RANGE_START}-${USER_RANGE_END}`);
  console.log(`Max Test Duration: ${MAX_TEST_DURATION}ms`);
  console.log(`========================================\n`);
  
  try {
    // Step 1: Report ready state
    await reportReady();
    
    // Step 2: Wait for start command
    console.log(`[Worker ${WORKER_INDEX}] Waiting for 'start' command...`);
    const startCommandReceived = await waitForCommand('start');
    
    if (!startCommandReceived) {
      console.error(`[Worker ${WORKER_INDEX}] Failed to receive start command. Exiting.`);
      process.exit(1);
    }
    
    console.log(`[Worker ${WORKER_INDEX}] ✓ Start command received`);
    
    // Step 3: Clear command and update to testing state
    await clearCommand();
    await updateState('testing', {
      testingStartedAt: new Date().toISOString()
    });
    
    console.log(`[Worker ${WORKER_INDEX}] ✓ State updated to 'testing'`);
    
    // Step 4: Run tests with stop monitoring
    const stopMonitor = monitorForStopCommand();
    const testExecution = runPlaywrightTests();
    
    // Wait for either tests to complete or stop command
    const result = await Promise.race([testExecution, stopMonitor]);
    
    // Stop the command monitor if still running
    if (commandPollInterval) {
      clearInterval(commandPollInterval);
      commandPollInterval = null;
    }
    
    console.log(`\n[Worker ${WORKER_INDEX}] Test execution result:`, result);
    
    // Step 5: Handle results based on outcome
    if (result === 'stopped' || result.status === 'stopped') {
      console.log(`[Worker ${WORKER_INDEX}] ✓ Worker stopped by command`);
      // State already updated to 'stopped' in monitorForStopCommand
      
    } else {
      // Tests completed (success, failure, or timeout)
      console.log(`[Worker ${WORKER_INDEX}] Tests completed, uploading results...`);
      
      try {
        // Step 6: Upload results
        await uploadAllResults();
        console.log(`[Worker ${WORKER_INDEX}] ✓ Results uploaded successfully`);
      } catch (uploadError) {
        console.error(`[Worker ${WORKER_INDEX}] ⚠️  Failed to upload results:`, uploadError.message);
        // Continue to update state even if upload fails
      }
      
      // Step 7: Update final state
      const finalState = result.status === 'timeout' ? 'finished' : 'finished';
      await updateState(finalState, {
        finishedAt: new Date().toISOString(),
        exitCode: result.code,
        status: result.status
      });
      
      console.log(`[Worker ${WORKER_INDEX}] ✓ State updated to '${finalState}'`);
    }
    
    console.log(`\n========================================`);
    console.log(`Worker ${WORKER_INDEX} - Lifecycle Complete`);
    console.log(`========================================\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error(`\n[Worker ${WORKER_INDEX}] ❌ Fatal error:`, error);
    console.error(error.stack);
    
    // Try to update state to failed
    try {
      await updateState('failed', {
        error: error.message,
        failedAt: new Date().toISOString()
      });
    } catch (stateError) {
      console.error(`[Worker ${WORKER_INDEX}] Failed to update error state:`, stateError.message);
    }
    
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown signals
 */
function setupSignalHandlers() {
  const handleShutdown = async (signal) => {
    console.log(`\n[Worker ${WORKER_INDEX}] Received ${signal}, shutting down gracefully...`);
    
    // Stop command polling
    if (commandPollInterval) {
      clearInterval(commandPollInterval);
      commandPollInterval = null;
    }
    
    // Kill Playwright if running
    if (playwrightProcess) {
      killProcessTree(playwrightProcess.pid);
    }
    
    // Update state to stopped
    try {
      await updateState('stopped', {
        stoppedAt: new Date().toISOString(),
        stoppedBy: signal
      });
    } catch (error) {
      console.error(`[Worker ${WORKER_INDEX}] Failed to update stopped state:`, error.message);
    }
    
    process.exit(0);
  };
  
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

// Setup signal handlers
setupSignalHandlers();

// Run main worker lifecycle
main().catch(error => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
