/**
 * Orchestrator logging utilities
 * Handles logging for the orchestrator
 */

const fs = require('fs');
const path = require('path');

/**
 * Logger class
 */
class Logger {
  constructor(runId, logDir = './logs') {
    this.runId = runId;
    this.logDir = logDir;
    this.logFile = path.join(logDir, `orchestrator-${runId}.log`);
    
    // Create log directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Write log entry
   * @param {string} level - Log level (INFO, WARN, ERROR)
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      runId: this.runId,
      message,
      data
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    // Write to file
    fs.appendFileSync(this.logFile, logLine);
    
    // Also log to console
    const consoleMessage = `[${timestamp}] [${level}] ${message}`;
    if (level === 'ERROR') {
      console.error(consoleMessage, data || '');
    } else if (level === 'WARN') {
      console.warn(consoleMessage, data || '');
    } else {
      console.log(consoleMessage, data || '');
    }
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  warn(message, data = null) {
    this.log('WARN', message, data);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
  }

  /**
   * Get log file path
   * @returns {string} Log file path
   */
  getLogFile() {
    return this.logFile;
  }

  /**
   * Read log file contents
   * @returns {Array} Log entries
   */
  readLogs() {
    if (!fs.existsSync(this.logFile)) {
      return [];
    }

    const content = fs.readFileSync(this.logFile, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line);
    
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { message: line };
      }
    });
  }
}

module.exports = Logger;
