/**
 * Parameter Loader - Loads test parameters from S3 storage
 */

const { getStorageConfigFromEnv } = require('@playwright-easyscale/shared/s3Client');
const { downloadJSON, uploadJSON } = require('@playwright-easyscale/shared/s3Operations');
const { getUserParametersPath, getWorkerStatusPath } = require('@playwright-easyscale/shared/storagePaths');

// Get storage config once
const storageConfig = getStorageConfigFromEnv();

/**
 * Load test parameters for the current test
 * @returns {Object} Test parameters
 */
async function loadTestParameters() {
  const runId = process.env.RUN_ID;
  const userRangeStart = parseInt(process.env.USER_RANGE_START || '1');

  if (!runId) {
    console.warn('No RUN_ID found, returning empty parameters');
    return {};
  }

  try {
    // Load parameters for the first user in range
    return await downloadJSON(storageConfig, getUserParametersPath(runId, userRangeStart));
  } catch (error) {
    console.error('Error loading test parameters:', error);
    return {};
  }
}

/**
 * Load parameters for a specific user index
 * @param {number} userIndex - User index (1-based)
 * @returns {Object} Test parameters
 */
async function loadParametersForUser(userIndex) {
  const runId = process.env.RUN_ID;

  if (!runId) {
    console.warn('No RUN_ID found, returning empty parameters');
    return {};
  }

  try {
    return await downloadJSON(storageConfig, getUserParametersPath(runId, userIndex));
  } catch (error) {
    console.error(`Error loading parameters for user ${userIndex}:`, error);
    return {};
  }
}

/**
 * Update worker status in S3
 * @param {Object} status - Worker status update
 */
async function updateWorkerStatus(status) {
  const runId = process.env.RUN_ID;
  const userRangeStart = parseInt(process.env.USER_RANGE_START || '1');
  const userRangeEnd = parseInt(process.env.USER_RANGE_END || '1');
  
  // Calculate worker index from user range
  const usersPerContainer = userRangeEnd - userRangeStart + 1;
  const workerIndex = Math.floor((userRangeStart - 1) / usersPerContainer) + 1;

  if (!runId) {
    console.warn('No RUN_ID found, cannot update worker status');
    return;
  }

  try {
    // Try to load existing status
    let current = {};
    try {
      current = await downloadJSON(storageConfig, getWorkerStatusPath(runId, workerIndex));
    } catch {
      // File doesn't exist yet, that's okay
    }
    
    const updated = {
      ...current,
      ...status,
      lastUpdated: new Date().toISOString()
    };

    await uploadJSON(storageConfig, getWorkerStatusPath(runId, workerIndex), updated);
  } catch (error) {
    console.error('Error updating worker status:', error);
  }
}

module.exports = {
  loadTestParameters,
  loadParametersForUser,
  updateWorkerStatus
};
