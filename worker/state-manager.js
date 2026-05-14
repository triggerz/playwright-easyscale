#!/usr/bin/env node

/**
 * Worker State Manager
 * Single source of truth for worker state management
 * Handles polling for commands and updating state
 */

const { uploadJSON, downloadJSON } = require('@playwright-easyscale/shared/s3Operations');
const { getWorkerStatusPath } = require('@playwright-easyscale/shared/storagePaths');

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
 * Read current worker state from S3
 */
async function readState() {
  try {
    const state = await downloadJSON(
      storageConfig,
      getWorkerStatusPath(RUN_ID, WORKER_INDEX)
    );
    return state;
  } catch (error) {
    console.error(`[State Manager ${WORKER_INDEX}] Failed to read state:`, error.message);
    return null;
  }
}

/**
 * Write worker state to S3
 */
async function writeState(updates) {
  try {
    const currentState = await readState() || {};
    
    const newState = {
      ...currentState,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    await uploadJSON(
      storageConfig,
      getWorkerStatusPath(RUN_ID, WORKER_INDEX),
      newState
    );
    
    console.log(`[State Manager ${WORKER_INDEX}] State updated:`, updates);
    return newState;
  } catch (error) {
    console.error(`[State Manager ${WORKER_INDEX}] Failed to write state:`, error.message);
    return null;
  }
}

/**
 * Update worker state (state field)
 */
async function updateState(state, additionalData = {}) {
  return await writeState({
    state,
    ...additionalData
  });
}

/**
 * Clear command after processing
 */
async function clearCommand() {
  return await writeState({
    command: null
  });
}

/**
 * Poll for commands from orchestrator
 */
async function pollForCommand(callback, interval = 2000) {
  console.log(`[State Manager ${WORKER_INDEX}] Starting command polling (interval: ${interval}ms)`);
  
  const poll = async () => {
    const state = await readState();
    if (state && state.command) {
      console.log(`[State Manager ${WORKER_INDEX}] Command received: ${state.command}`);
      await callback(state.command, state);
    }
  };
  
  // Initial poll
  await poll();
  
  // Set up interval
  const intervalId = setInterval(poll, interval);
  
  return intervalId;
}

/**
 * Wait for specific command
 */
async function waitForCommand(expectedCommand, maxWaitTime = null) {
  console.log(`[State Manager ${WORKER_INDEX}] Waiting for command: ${expectedCommand}`);
  
  const startTime = Date.now();
  const pollInterval = 2000;
  
  while (true) {
    const state = await readState();
    
    if (state && state.command === expectedCommand) {
      console.log(`[State Manager ${WORKER_INDEX}] ✓ Command received: ${expectedCommand}`);
      return true;
    }
    
    // Only check timeout if maxWaitTime is specified
    if (maxWaitTime !== null && Date.now() - startTime >= maxWaitTime) {
      console.error(`[State Manager ${WORKER_INDEX}] Timeout waiting for command: ${expectedCommand}`);
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

module.exports = {
  readState,
  writeState,
  updateState,
  clearCommand,
  pollForCommand,
  waitForCommand
};
