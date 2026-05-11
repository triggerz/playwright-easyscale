/**
 * Configuration loader and validator
 * Loads JSON config files and validates required fields
 */

const fs = require('fs');
const path = require('path');

/**
 * Load and validate configuration file
 * @param {string} configPath - Path to config file
 * @returns {Object} Validated configuration
 */
function loadConfig(configPath) {
  // Try multiple resolution strategies for Railway deployment
  let resolvedPath;
  
  if (path.isAbsolute(configPath)) {
    resolvedPath = configPath;
  } else {
    // Try relative to project root first (for monorepo on Railway)
    resolvedPath = path.resolve(__dirname, '../../', configPath);
    
    // If not found, try relative to current working directory
    if (!fs.existsSync(resolvedPath)) {
      resolvedPath = path.resolve(process.cwd(), configPath);
    }
    
    // If still not found, try relative to orchestrator directory
    if (!fs.existsSync(resolvedPath)) {
      resolvedPath = path.resolve(__dirname, '../', configPath);
    }
  }
  
  console.log(`[DEBUG] Config path resolution:`);
  console.log(`  - Input: ${configPath}`);
  console.log(`  - __dirname: ${__dirname}`);
  console.log(`  - process.cwd(): ${process.cwd()}`);
  console.log(`  - Resolved to: ${resolvedPath}`);
  console.log(`  - Exists: ${fs.existsSync(resolvedPath)}`);
  
  if (!fs.existsSync(resolvedPath)) {
    // List what files ARE available
    const cwd = process.cwd();
    console.log(`\n[DEBUG] Files in current directory (${cwd}):`);
    try {
      const files = fs.readdirSync(cwd);
      files.forEach(f => console.log(`  - ${f}`));
    } catch (e) {
      console.log(`  Error listing: ${e.message}`);
    }
    
    throw new Error(`Configuration file not found: ${configPath} (resolved to: ${resolvedPath})`);
  }

  const configContent = fs.readFileSync(resolvedPath, 'utf-8');
  let config;

  try {
    config = JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Invalid JSON in configuration file: ${error.message}`);
  }

  // Substitute environment variables
  config = substituteEnvVars(config);

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Recursively substitute environment variables in config
 * Supports ${VAR_NAME} and ${{VAR_NAME}} syntax
 * @param {any} obj - Object to process
 * @returns {any} Processed object
 */
function substituteEnvVars(obj) {
  if (typeof obj === 'string') {
    // Match ${VAR} or ${{VAR}}
    return obj.replace(/\$\{?\{?([A-Z_][A-Z0-9_]*)\}?\}?/g, (match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        console.warn(`Warning: Environment variable ${varName} is not set`);
        return match; // Keep original if not found
      }
      return value;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => substituteEnvVars(item));
  } else if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = substituteEnvVars(obj[key]);
    }
    return result;
  }
  return obj;
}

/**
 * Validate configuration schema
 * @param {Object} config - Configuration to validate
 * @throws {Error} If validation fails
 */
function validateConfig(config) {
  const errors = [];

  // Required top-level fields
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Missing or invalid "name" field');
  }

  if (!config.totalUsers || typeof config.totalUsers !== 'number' || config.totalUsers < 1) {
    errors.push('Missing or invalid "totalUsers" field (must be a positive number)');
  }

  if (!config.usersPerContainer || typeof config.usersPerContainer !== 'number' || config.usersPerContainer < 1) {
    errors.push('Missing or invalid "usersPerContainer" field (must be a positive number)');
  }

  if (!config.testFile || typeof config.testFile !== 'string') {
    errors.push('Missing or invalid "testFile" field');
  }

  // Validate Railway configuration
  if (!config.railway || typeof config.railway !== 'object') {
    errors.push('Missing "railway" configuration');
  } else {
    if (!config.railway.projectId) {
      errors.push('Missing "railway.projectId"');
    }
    if (!config.railway.serviceId) {
      errors.push('Missing "railway.serviceId"');
    }
    if (!config.railway.apiToken) {
      errors.push('Missing "railway.apiToken"');
    }
  }

  // Validate storage configuration
  if (!config.storage || typeof config.storage !== 'object') {
    errors.push('Missing "storage" configuration');
  } else {
    if (!config.storage.endpoint) {
      errors.push('Missing "storage.endpoint"');
    }
    if (!config.storage.accessKey) {
      errors.push('Missing "storage.accessKey"');
    }
    if (!config.storage.secretKey) {
      errors.push('Missing "storage.secretKey"');
    }
    if (!config.storage.bucket) {
      errors.push('Missing "storage.bucket"');
    }
    // Region is optional, defaults to 'auto'
    config.storage.region = config.storage.region || 'auto';
  }

  // Set defaults for optional fields
  config.environment = config.environment || {};
  config.options = config.options || {};
  config.options.headless = config.options.headless !== false;
  config.options.timeout = config.options.timeout || 300000;
  config.options.retries = config.options.retries || 0;
  config.options.maxConcurrency = config.options.maxConcurrency || 5;

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

module.exports = {
  loadConfig,
  substituteEnvVars,
  validateConfig
};
