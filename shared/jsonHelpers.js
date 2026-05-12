/**
 * JSON Helper Utilities
 * Safe JSON operations with error handling
 */

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails (default: null)
 * @returns {*} Parsed object or default value
 */
function safeJSONParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse error:', error.message);
    return defaultValue;
  }
}

/**
 * Safely stringify object to JSON
 * @param {*} data - Data to stringify
 * @param {boolean} pretty - Whether to pretty-print (default: false)
 * @param {*} defaultValue - Default value if stringify fails (default: '{}')
 * @returns {string} JSON string or default value
 */
function safeJSONStringify(data, pretty = false, defaultValue = '{}') {
  try {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  } catch (error) {
    console.error('JSON stringify error:', error.message);
    return defaultValue;
  }
}

/**
 * Parse JSON lines format (one JSON object per line)
 * @param {string} content - Content with JSON lines
 * @returns {Array} Array of parsed objects
 */
function parseJSONLines(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const results = [];
  
  for (const line of lines) {
    const parsed = safeJSONParse(line);
    if (parsed !== null) {
      results.push(parsed);
    }
  }
  
  return results;
}

/**
 * Merge objects with safe JSON operations
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
function mergeJSON(...objects) {
  return Object.assign({}, ...objects);
}

module.exports = {
  safeJSONParse,
  safeJSONStringify,
  parseJSONLines,
  mergeJSON
};
