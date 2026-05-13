/**
 * Storage Path Generators
 * Centralized functions for generating S3 object keys
 */

/**
 * Get path for run metadata
 * @param {string} runId - Run identifier
 * @returns {string} S3 key path
 */
function getRunMetadataPath(runId) {
  return `runs/${runId}.json`;
}

/**
 * Get path for user parameters
 * @param {string} runId - Run identifier
 * @param {number} userIndex - User index (1-based)
 * @returns {string} S3 key path
 */
function getUserParametersPath(runId, userIndex) {
  return `runs/${runId}/parameters/user-${userIndex}.json`;
}

/**
 * Get path for worker status
 * @param {string} runId - Run identifier
 * @param {number} workerIndex - Worker index
 * @returns {string} S3 key path
 */
function getWorkerStatusPath(runId, workerIndex) {
  return `runs/${runId}/workers/worker-${workerIndex}.json`;
}

/**
 * Get prefix for all workers in a run
 * @param {string} runId - Run identifier
 * @returns {string} S3 prefix path
 */
function getWorkersPrefix(runId) {
  return `runs/${runId}/workers/`;
}

/**
 * Get prefix for all parameters in a run
 * @param {string} runId - Run identifier
 * @returns {string} S3 prefix path
 */
function getParametersPrefix(runId) {
  return `runs/${runId}/parameters/`;
}

/**
 * Get prefix for all runs
 * @returns {string} S3 prefix path
 */
function getRunsPrefix() {
  return 'runs/';
}

/**
 * Get prefix for logs in a run
 * @param {string} runId - Run identifier
 * @returns {string} S3 prefix path
 */
function getLogsPrefix(runId) {
  return `logs/${runId}/`;
}

/**
 * Get path for worker log file
 * @param {string} runId - Run identifier
 * @param {number} workerIndex - Worker index
 * @returns {string} S3 key path
 */
function getWorkerLogPath(runId, workerIndex) {
  return `logs/${runId}/worker-${workerIndex}.log`;
}

/**
 * Get prefix for results in a run
 * @param {string} runId - Run identifier
 * @returns {string} S3 prefix path
 */
function getResultsPrefix(runId) {
  return `results/${runId}/`;
}

/**
 * Get path for run control signals
 * @param {string} runId - Run identifier
 * @returns {string} S3 key path
 */
function getRunControlPath(runId) {
  return `runs/${runId}/control.json`;
}

module.exports = {
  getRunMetadataPath,
  getUserParametersPath,
  getWorkerStatusPath,
  getWorkersPrefix,
  getParametersPrefix,
  getRunsPrefix,
  getLogsPrefix,
  getWorkerLogPath,
  getResultsPrefix,
  getRunControlPath
};
