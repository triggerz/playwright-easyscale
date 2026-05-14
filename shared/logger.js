/**
 * Unified Logger - Logs to console and optionally to S3
 * Provides consistent logging with timestamps across the project
 */

const { uploadJSON } = require('./s3Operations');

/**
 * Format timestamp in ISO format with timezone
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Calculate success rate percentage
 */
function calculateSuccessRate(passed, total) {
  if (total === 0) return '0.00';
  return ((passed / total) * 100).toFixed(2);
}

/**
 * Create a logger instance
 * @param {Object} storageConfig - Optional S3 storage configuration
 * @param {string} runId - Optional run identifier for S3 logging
 * @param {Object} metadata - Optional metadata to include in all logs (e.g., workerIndex, source)
 * @returns {Object} Logger instance with info, error, warn, success methods
 */
function createLogger(storageConfig = null, runId = null, metadata = {}) {
  // Auto-detect from environment if not provided (for workers)
  const effectiveRunId = runId || process.env.RUN_ID;
  const effectiveStorageConfig = storageConfig || (process.env.S3_ENDPOINT ? {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'auto'
  } : null);

  /**
   * Log to console and optionally to S3
   */
  async function log(level, message, context = {}) {
    const timestamp = getTimestamp();
    const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
    
    // Always log to console
    const consoleMessage = `[${timestamp}] [${level}] ${message}${contextStr}`;
    if (level === 'ERROR') {
      console.error(consoleMessage);
    } else if (level === 'WARN') {
      console.warn(consoleMessage);
    } else {
      console.log(consoleMessage);
    }

    // Log to S3 if runId and storageConfig are available
    if (effectiveRunId && effectiveStorageConfig) {
      try {
        const logEntry = {
          timestamp,
          level,
          message,
          runId: effectiveRunId,
          ...metadata,
          ...context
        };

        // Create a unique log file name with timestamp to avoid conflicts
        const source = metadata.source || (metadata.workerIndex ? 'worker' : 'orchestrator');
        const identifier = metadata.workerIndex ? `worker-${metadata.workerIndex}` : 'orchestrator';
        const logFileName = `${identifier}-${Date.now()}.json`;
        const key = `logs/${effectiveRunId}/${logFileName}`;

        await uploadJSON(effectiveStorageConfig, key, logEntry);
      } catch (error) {
        console.error('Failed to upload log to S3:', error.message);
      }
    }
  }

  return {
    /**
     * Info level log
     */
    info: async (message, context = {}) => {
      await log('INFO', message, context);
    },

    /**
     * Error level log
     */
    error: async (message, context = {}) => {
      await log('ERROR', message, context);
    },

    /**
     * Warning level log
     */
    warn: async (message, context = {}) => {
      await log('WARN', message, context);
    },

    /**
     * Success level log
     */
    success: async (message, context = {}) => {
      await log('SUCCESS', `✓ ${message}`, context);
    }
  };
}

// Export standalone functions for backward compatibility (console-only)
function info(message, context = {}) {
  const timestamp = getTimestamp();
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  const logMessage = `[${timestamp}] [INFO] ${message}${contextStr}`;
  console.log(logMessage);
  return logMessage;
}

function error(message, context = {}) {
  const timestamp = getTimestamp();
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  const logMessage = `[${timestamp}] [ERROR] ${message}${contextStr}`;
  console.error(logMessage);
  return logMessage;
}

function warn(message, context = {}) {
  const timestamp = getTimestamp();
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  const logMessage = `[${timestamp}] [WARN] ${message}${contextStr}`;
  console.warn(logMessage);
  return logMessage;
}

function success(message, context = {}) {
  const timestamp = getTimestamp();
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  const logMessage = `[${timestamp}] [SUCCESS] ✓ ${message}${contextStr}`;
  console.log(logMessage);
  return logMessage;
}

module.exports = {
  createLogger,
  getTimestamp,
  formatDuration,
  calculateSuccessRate,
  // Backward compatible exports (console-only)
  info,
  error,
  warn,
  success
};
