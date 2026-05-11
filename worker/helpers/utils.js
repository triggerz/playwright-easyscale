/**
 * Utility functions for Playwright tests
 */

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Parse environment variable as integer with default
 * @param {string} varName - Environment variable name
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
const getEnvInt = (varName, defaultValue) => {
  const value = process.env[varName];
  return value ? parseInt(value, 10) : defaultValue;
};

/**
 * Parse environment variable as boolean with default
 * @param {string} varName - Environment variable name
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
const getEnvBool = (varName, defaultValue) => {
  const value = process.env[varName];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
};

/**
 * Get environment variable with default
 * @param {string} varName - Environment variable name
 * @param {string} defaultValue - Default value if not set
 * @returns {string}
 */
const getEnv = (varName, defaultValue) => {
  return process.env[varName] || defaultValue;
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise<any>}
 */
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  throw lastError;
};

module.exports = {
  sleep,
  getEnvInt,
  getEnvBool,
  getEnv,
  retryWithBackoff
};
