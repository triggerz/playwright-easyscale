/**
 * User distribution logic
 * Calculates how to distribute users across containers
 */

/**
 * Calculate container distribution
 * @param {number} totalUsers - Total number of users to simulate
 * @param {number} usersPerContainer - Users per container
 * @returns {Object} Distribution plan
 */
function calculateDistribution(totalUsers, usersPerContainer) {
  const totalContainers = Math.ceil(totalUsers / usersPerContainer);
  const containers = [];

  for (let i = 0; i < totalContainers; i++) {
    const startUser = i * usersPerContainer + 1;
    const endUser = Math.min((i + 1) * usersPerContainer, totalUsers);
    const userCount = endUser - startUser + 1;

    containers.push({
      index: i + 1,
      startUser,
      endUser,
      userCount,
      shardIndex: i + 1,
      shardTotal: totalContainers
    });
  }

  return {
    totalContainers,
    totalUsers,
    usersPerContainer,
    containers
  };
}

/**
 * Generate environment variables for a container
 * @param {Object} container - Container info from distribution
 * @param {Object} config - Test configuration
 * @param {string} runId - Unique run identifier
 * @returns {Object} Environment variables
 */
function generateContainerEnv(container, config, runId) {
  const env = {
    // User range for this container
    USER_RANGE_START: container.startUser.toString(),
    USER_RANGE_END: container.endUser.toString(),
    SHARD_INDEX: container.shardIndex.toString(),
    SHARD_TOTAL: container.shardTotal.toString(),
    
    // Run identification
    RUN_ID: runId,
    
    // Storage configuration
    STORAGE_ENDPOINT: config.storage.endpoint,
    STORAGE_ACCESS_KEY: config.storage.accessKey,
    STORAGE_SECRET_KEY: config.storage.secretKey,
    STORAGE_BUCKET: config.storage.bucket,
    STORAGE_REGION: config.storage.region || 'auto',
    
    // Test options
    HEADLESS: config.options.headless.toString(),
    TIMEOUT: config.options.timeout.toString(),
    RETRIES: config.options.retries.toString(),
    MAX_CONCURRENCY: config.options.maxConcurrency.toString()
  };

  // Add custom environment variables from config
  if (config.environment) {
    Object.assign(env, config.environment);
  }

  return env;
}

/**
 * Display distribution plan
 * @param {Object} distribution - Distribution plan
 * @param {Object} config - Test configuration
 */
function displayDistributionPlan(distribution, config) {
  console.log('\n📊 Distribution Plan:');
  console.log(`   Test: ${config.name}`);
  console.log(`   Total Users: ${distribution.totalUsers}`);
  console.log(`   Users per Container: ${distribution.usersPerContainer}`);
  console.log(`   Total Containers: ${distribution.totalContainers}`);
  console.log('\n   Container Breakdown:');
  
  distribution.containers.forEach(container => {
    console.log(`   Container ${container.index}: Users ${container.startUser}-${container.endUser} (${container.userCount} users)`);
  });
  
  console.log('');
}

module.exports = {
  calculateDistribution,
  generateContainerEnv,
  displayDistributionPlan
};
