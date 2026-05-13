#!/usr/bin/env node

/**
 * Command Monitor
 * Runs in parallel with Playwright tests to detect and handle commands from orchestrator
 */

const { readState, updateState, clearCommand, pollForCommand } = require('./state-manager');

const WORKER_INDEX = parseInt(process.env.SHARD_INDEX || '1');

/**
 * Handle stop command
 */
async function handleStopCommand() {
  console.log(`[Command Monitor ${WORKER_INDEX}] ⚠️ Stop command received!`);
  console.log(`[Command Monitor ${WORKER_INDEX}] Stopping test execution...`);
  
  // Clear the command
  await clearCommand();
  
  // Update state to stopped
  await updateState('stopped', {
    stoppedAt: new Date().toISOString()
  });
  
  console.log(`[Command Monitor ${WORKER_INDEX}] ✓ State updated to 'stopped'`);
  
  // Kill the Playwright process
  try {
    process.kill(process.ppid, 'SIGTERM');
  } catch (error) {
    console.error(`[Command Monitor ${WORKER_INDEX}] Failed to kill parent process:`, error.message);
  }
  
  // Exit after a moment
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

/**
 * Command handler
 */
async function handleCommand(command, state) {
  console.log(`[Command Monitor ${WORKER_INDEX}] Processing command: ${command}`);
  
  switch (command) {
    case 'stop':
      await handleStopCommand();
      break;
    
    default:
      console.log(`[Command Monitor ${WORKER_INDEX}] Unknown command: ${command}`);
      await clearCommand();
  }
}

/**
 * Start monitoring for commands
 */
async function main() {
  console.log(`[Command Monitor ${WORKER_INDEX}] Started monitoring for commands...`);
  
  // Poll for commands every 5 seconds
  await pollForCommand(handleCommand, 5000);
}

// Start monitoring
main().catch(error => {
  console.error(`[Command Monitor ${WORKER_INDEX}] Monitor failed:`, error);
  process.exit(1);
});
