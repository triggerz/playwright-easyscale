/**
 * Run Manager - Manages test run lifecycle
 */

const crypto = require('crypto');
const { calculateDistribution, generateContainerEnv } = require('../distributor');
const RailwayClient = require('../railway');
const { uploadJSON, downloadJSON, listS3Objects, getPresignedUrl, deleteS3ObjectsByPrefix } = require('@playwright-easyscale/shared/s3Operations');
const { 
  getRunMetadataPath, 
  getUserParametersPath, 
  getWorkerStatusPath,
  getWorkersPrefix,
  getRunsPrefix,
  getLogsPrefix
} = require('@playwright-easyscale/shared/storagePaths');
const { safeJSONParse, parseJSONLines } = require('@playwright-easyscale/shared/jsonHelpers');
const { createLogger, formatDuration, calculateSuccessRate } = require('@playwright-easyscale/shared/logger');

class RunManager {
  constructor() {
    this.storageConfig = null;
  }

  /**
   * Initialize run manager with storage configuration
   */
  async initialize(storageConfig) {
    this.storageConfig = storageConfig || {
      endpoint: process.env.S3_ENDPOINT,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION || 'auto'
    };
  }

  /**
   * Create a new test run
   * @param {Object} config - Run configuration
   * @returns {Object} Run information
   */
  async createRun(config) {
    const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Calculate distribution
    const distribution = calculateDistribution(config.totalUsers, config.usersPerContainer);

    // Store run metadata with all test parameters
    const runMetadata = {
      id: runId,
      testFile: config.testFile,
      totalUsers: config.totalUsers,
      usersPerContainer: config.usersPerContainer,
      totalContainers: distribution.totalContainers,
      status: 'pending',
      startedAt: new Date().toISOString(),
      containers: distribution.containers,
      parameters: config.parameters
    };

    // Save run metadata to S3
    await uploadJSON(this.storageConfig, getRunMetadataPath(runId), runMetadata);

    // Save test parameters for each user to S3
    for (let i = 1; i <= config.totalUsers; i++) {
      // Deep clone parameters for this user
      const userParams = JSON.parse(JSON.stringify(config.parameters || {}));
      
      // Distribute array parameters to individual users
      // If a parameter is an array, assign the appropriate element to this user
      for (const [key, value] of Object.entries(userParams)) {
        if (Array.isArray(value) && value.length > 0) {
          // Assign the appropriate array element to this user (with cycling)
          const arrayIndex = (i - 1) % value.length;
          userParams[key] = value[arrayIndex];
        }
      }
      
      await uploadJSON(
        this.storageConfig,
        getUserParametersPath(runId, i),
        userParams
      );
    }

    return {
      runId,
      ...runMetadata
    };
  }

  /**
   * Deploy containers for a run using Railway's service duplication
   * @param {string} runId - Run identifier
   * @param {Object} railwayConfig - Railway configuration
   */
  async deployRun(runId, railwayConfig) {
    const startTime = Date.now();
    const runMetadata = await this.getRun(runId);
    if (!runMetadata) {
      throw new Error(`Run ${runId} not found`);
    }

    const railway = new RailwayClient(railwayConfig.apiToken);
    const deployments = [];
    const spawnedServices = [];

    // Update status to deploying
    await this.updateRunStatus(runId, 'deploying');

    // Create logger for this run (logs to both console and S3)
    const logger = createLogger(this.storageConfig, runId, { source: 'orchestrator' });
    
    // Log deployment start
    await logger.info('🚀 RUN STARTED', {
      event: 'run_started',
      testFile: runMetadata.testFile,
      totalUsers: runMetadata.totalUsers,
      totalContainers: runMetadata.containers.length,
      usersPerContainer: runMetadata.usersPerContainer
    });

    for (const container of runMetadata.containers) {
      try {
        const workerName = `worker-${runId}-${container.index}`;
        
        // Generate environment variables for this container
        const baseEnv = generateContainerEnv(container, {
          storage: railwayConfig.storage,
          testFile: runMetadata.testFile
        }, runId);

        // Convert to Railway variable format (each value needs to be wrapped in {value: ...})
        const railwayVariables = {};
        for (const [key, value] of Object.entries(baseEnv)) {
          railwayVariables[key] = { value: String(value) };
        }
        
        // Add additional required variables
        railwayVariables.TEST_FILE = { value: runMetadata.testFile };
        railwayVariables.RUN_ID = { value: runId };

        // Spawn a new worker service (with retry and verification)
        const workerService = await railway.spawnWorker(
          railwayConfig.projectId,
          railwayConfig.environmentId,
          workerName,
          railwayVariables
        );

        // Only proceed if Railway confirmed the service was created and verified
        if (!workerService || !workerService.serviceId) {
          throw new Error(`Worker service creation failed - no service ID returned for ${workerName}`);
        }

        await logger.info(`Worker ${workerName} spawned and verified`, {
          event: 'worker_verified',
          workerIndex: container.index,
          serviceId: workerService.serviceId,
          attempt: workerService.attempt || 1
        });

        spawnedServices.push(workerService.serviceId);

        deployments.push({
          container,
          serviceId: workerService.serviceId,
          serviceName: workerService.serviceName,
          status: workerService.status,
          commitId: workerService.commitId
        });

        // Store initial worker status in S3 (only after Railway verification)
        await this.updateWorkerStatus(runId, container.index, {
          index: container.index,
          startUser: container.startUser,
          endUser: container.endUser,
          userCount: container.userCount,
          state: 'deploying',
          command: null,
          serviceId: workerService.serviceId,
          serviceName: workerService.serviceName,
          commitId: workerService.commitId,
          startedAt: new Date().toISOString()
        });

        // Delay between spawning workers to avoid overwhelming Railway API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        await logger.error(`Error spawning worker for container ${container.index}`, {
          event: 'worker_spawn_error',
          containerIndex: container.index,
          error: error.message,
          stack: error.stack
        });
        
        // Clean up any services that were created before the error
        await logger.info('Cleaning up spawned services due to error...');
        for (const serviceId of spawnedServices) {
          try {
            await railway.deleteService(serviceId);
            console.log(`Deleted service ${serviceId}`);
          } catch (cleanupError) {
            console.error(`Failed to delete service ${serviceId}:`, cleanupError.message);
          }
        }
        
        throw error;
      }
    }

    // Update status to running with spawned service IDs
    await this.updateRunStatus(runId, 'running', { 
      deployments,
      spawnedServices,
      deploymentStartTime: startTime
    });

    const spawnDuration = Date.now() - startTime;
    await logger.info('All workers spawned, waiting for deployment...', {
      event: 'workers_spawned',
      workersSpawned: deployments.length,
      duration: formatDuration(spawnDuration)
    });
    
    // Wait for all workers to become ready
    try {
      await this.waitForAllWorkersReady(runId, deployments.length, logger);
      
      const totalDuration = Date.now() - startTime;
      await logger.success('DEPLOYMENT COMPLETED - All workers ready!', {
        event: 'deployment_completed',
        workersReady: deployments.length,
        totalDuration: formatDuration(totalDuration),
        spawnDuration: formatDuration(spawnDuration)
      });
    } catch (error) {
      // Log the error but don't throw - deployment technically succeeded, just some workers didn't come online
      await logger.error(`Deployment verification failed: ${error.message}`, {
        event: 'deployment_verification_failed',
        error: error.message
      });
    }
    
    return deployments;
  }


  /**
   * Get run information from S3
   * @param {string} runId - Run identifier
   * @returns {Object} Run information
   */
  async getRun(runId) {
    try {
      return await downloadJSON(this.storageConfig, getRunMetadataPath(runId));
    } catch (error) {
      console.error(`Error loading run ${runId}:`, error);
      return null;
    }
  }

  /**
   * Get all runs from S3 storage
   * @returns {Array} Array of runs
   */
  async getAllRuns() {
    try {
      // List all run metadata files from S3
      const objects = await listS3Objects(this.storageConfig, getRunsPrefix());
      
      // Filter for run metadata files (runs/run-*.json, not subdirectories)
      const runMetadataFiles = objects.filter(obj => {
        const key = obj.Key;
        // Match pattern: runs/run-TIMESTAMP-HASH.json
        return key.startsWith('runs/run-') && key.endsWith('.json') && !key.includes('/', 5);
      });
      
      const runs = await Promise.all(
        runMetadataFiles.map(async obj => {
          try {
            return await downloadJSON(this.storageConfig, obj.Key);
          } catch (err) {
            console.error(`Error loading run ${obj.Key}:`, err);
            return null;
          }
        })
      );
      
      // Filter out any null values from failed downloads
      const validRuns = runs.filter(run => run !== null);
      
      return validRuns.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    } catch (error) {
      console.error('Error loading runs from storage:', error);
      return [];
    }
  }

  /**
   * Get worker statuses for a run from S3
   * @param {string} runId - Run identifier
   * @returns {Array} Array of worker statuses
   */
  async getWorkers(runId) {
    try {
      const objects = await listS3Objects(this.storageConfig, getWorkersPrefix(runId));
      
      const workers = await Promise.all(
        objects
          .filter(obj => obj.Key.endsWith('.json'))
          .map(async obj => await downloadJSON(this.storageConfig, obj.Key))
      );
      
      return workers.sort((a, b) => a.index - b.index);
    } catch (error) {
      console.error('Error loading workers:', error);
      return [];
    }
  }

  /**
   * Send start command to all workers
   * @param {string} runId - Run identifier
   */
  async startRun(runId) {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    console.log(`Sending start command to all workers for run ${runId}`);
    
    // Get all workers and send start command to each
    const workers = await this.getWorkers(runId);
    
    for (const worker of workers) {
      await this.updateWorkerStatus(runId, worker.index, {
        ...worker,
        command: 'start'
      });
      console.log(`  ✓ Start command sent to worker ${worker.index}`);
    }
    
    await this.updateRunStatus(runId, 'running', {
      startedAt: new Date().toISOString()
    });
    
    console.log(`Start command sent to ${workers.length} workers`);
  }

  /**
   * Clean up spawned worker services
   * @param {string} runId - Run identifier
   * @param {Object} railwayConfig - Railway configuration
   * @returns {Promise<Object>} Deletion results
   */
  async cleanupWorkers(runId, railwayConfig) {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (!run.spawnedServices || run.spawnedServices.length === 0) {
      console.log(`No workers to clean up for run ${runId}`);
      return { deleted: 0, failed: 0 };
    }

    console.log(`Cleaning up ${run.spawnedServices.length} spawned worker services for run ${runId}`);
    const railway = new RailwayClient(railwayConfig.apiToken);
    
    const results = {
      deleted: 0,
      failed: 0,
      services: []
    };
    
    for (const serviceId of run.spawnedServices) {
      try {
        await railway.deleteService(serviceId);
        console.log(`Deleted worker service ${serviceId}`);
        results.deleted++;
        results.services.push({ serviceId, status: 'deleted' });
      } catch (error) {
        console.error(`Failed to delete service ${serviceId}:`, error.message);
        results.failed++;
        results.services.push({ serviceId, status: 'failed', error: error.message });
      }
    }
    
    // Mark all workers as deleted in S3
    const workers = await this.getWorkers(runId);
    for (const worker of workers) {
      await this.updateWorkerStatus(runId, worker.index, {
        ...worker,
        state: 'deleted',
        deletedAt: new Date().toISOString()
      });
    }
    
    await this.updateRunStatus(runId, 'deleted', {
      servicesCleanedUp: true,
      cleanedUpAt: new Date().toISOString()
    });
    
    console.log(`Workers cleaned up for run ${runId}: ${results.deleted} deleted, ${results.failed} failed`);
    return results;
  }

  /**
   * Stop a run by sending stop command to workers
   * @param {string} runId - Run identifier
   */
  async stopRun(runId) {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    console.log(`Sending stop command to all workers for run ${runId}`);
    
    // Get all workers and send stop command to each
    const workers = await this.getWorkers(runId);
    
    for (const worker of workers) {
      // Only send stop command to workers that are testing
      if (worker.state === 'testing') {
        await this.updateWorkerStatus(runId, worker.index, {
          ...worker,
          command: 'stop'
        });
        console.log(`  ✓ Stop command sent to worker ${worker.index}`);
      } else {
        console.log(`  - Worker ${worker.index} not testing (state: ${worker.state}), skipping`);
      }
    }
    
    await this.updateRunStatus(runId, 'stopping', {
      stoppingAt: new Date().toISOString()
    });
    
    console.log(`Stop command sent to workers`);
  }

  /**
   * Reset a run by clearing commands and resetting workers to ready
   * @param {string} runId - Run identifier
   */
  async resetRun(runId) {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    console.log(`Resetting run ${runId}`);
    
    // Reset all workers to ready state
    const workers = await this.getWorkers(runId);
    for (const worker of workers) {
      // Only reset workers that are stopped
      if (worker.state === 'stopped') {
        await this.updateWorkerStatus(runId, worker.index, {
          ...worker,
          state: 'ready',
          command: null,
          resetAt: new Date().toISOString()
        });
        console.log(`  ✓ Worker ${worker.index} reset to ready`);
      } else {
        console.log(`  - Worker ${worker.index} not stopped (state: ${worker.state}), skipping`);
      }
    }
    
    await this.updateRunStatus(runId, 'ready', {
      resetAt: new Date().toISOString()
    });
    
    console.log(`Run ${runId} reset to ready state`);
  }

  /**
   * Update run status in S3
   * @param {string} runId - Run identifier
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to merge
   */
  async updateRunStatus(runId, status, additionalData = {}) {
    try {
      const run = await this.getRun(runId);
      if (!run) {
        throw new Error(`Run ${runId} not found`);
      }
      
      const updated = {
        ...run,
        status,
        ...additionalData,
        lastUpdated: new Date().toISOString()
      };
      
      await uploadJSON(this.storageConfig, getRunMetadataPath(runId), updated);
    } catch (error) {
      console.error('Error updating run status:', error);
    }
  }

  /**
   * Update worker status in S3
   * @param {string} runId - Run identifier
   * @param {number} workerIndex - Worker index
   * @param {Object} status - Worker status data
   */
  async updateWorkerStatus(runId, workerIndex, status) {
    try {
      await uploadJSON(
        this.storageConfig,
        getWorkerStatusPath(runId, workerIndex),
        {
          ...status,
          lastUpdated: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error('Error updating worker status:', error);
    }
  }

  /**
   * Get logs for a run from S3 storage
   * @param {string} runId - Run identifier
   * @returns {Array} Array of log entries
   */
  async getRunLogs(runId) {
    try {
      const { downloadFromS3 } = require('@playwright-easyscale/shared/s3Operations');
      
      // List all log files for this run
      const objects = await listS3Objects(this.storageConfig, getLogsPrefix(runId));
      
      const logs = [];
      for (const obj of objects) {
        if (obj.Key.endsWith('.log') || obj.Key.endsWith('.json')) {
          const content = await downloadFromS3(this.storageConfig, obj.Key);
          
          // Try to parse as a single JSON object first (from our logger)
          const singleObject = safeJSONParse(content);
          if (singleObject !== null) {
            logs.push(singleObject);
          } else {
            // If not a single JSON object, try JSON lines format
            const parsedLines = parseJSONLines(content);
            if (parsedLines.length > 0) {
              logs.push(...parsedLines);
            } else {
              // If not JSON lines, treat as plain text
              const lines = content.split('\n').filter(line => line.trim());
              for (const line of lines) {
                logs.push({
                  timestamp: new Date().toISOString(),
                  level: 'info',
                  message: line
                });
              }
            }
          }
        }
      }
      
      return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
      console.error('Error loading logs from storage:', error);
      return [];
    }
  }

  /**
   * Get test results for a run from S3 storage
   * @param {string} runId - Run identifier
   * @returns {Array} Array of worker results
   */
  async getRunResults(runId) {
    try {
      const { getResultsPrefix } = require('@playwright-easyscale/shared/storagePaths');
      
      // List all result files for this run
      const objects = await listS3Objects(this.storageConfig, getResultsPrefix(runId));
      
      console.log(`Found ${objects.length} result objects for run ${runId}`);
      
      const results = [];
      for (const obj of objects) {
        if (obj.Key.endsWith('results.json')) {
          console.log(`Processing result file: ${obj.Key}`);
          try {
            const result = await downloadJSON(this.storageConfig, obj.Key);
            results.push(result);
          } catch (err) {
            console.error(`Error loading result ${obj.Key}:`, err);
          }
        }
      }
      
      // Sort by worker index
      return results.sort((a, b) => {
        const aIndex = parseInt(a.shardIndex) || 0;
        const bIndex = parseInt(b.shardIndex) || 0;
        return aIndex - bIndex;
      });
    } catch (error) {
      console.error('Error loading results from storage:', error);
      return [];
    }
  }

  /**
   * Get screenshots for a run from S3 storage with presigned URLs
   * @param {string} runId - Run identifier
   * @returns {Array} Array of screenshot metadata with presigned URLs
   */
  async getRunScreenshots(runId) {
    try {
      const { getResultsPrefix } = require('@playwright-easyscale/shared/storagePaths');
      
      // List all files in results prefix
      const objects = await listS3Objects(this.storageConfig, getResultsPrefix(runId));
      
      // Filter for screenshot files
      const screenshotObjects = objects.filter(obj => {
        const key = obj.Key.toLowerCase();
        return key.includes('/screenshots/') && 
               (key.endsWith('.png') || key.endsWith('.jpg') || key.endsWith('.jpeg') || 
                key.endsWith('.gif') || key.endsWith('.webm') || key.endsWith('.mp4'));
      });
      
      // Generate presigned URLs for each screenshot (1 hour expiration)
      const screenshots = await Promise.all(
        screenshotObjects.map(async obj => {
          // Extract worker index from path: results/{runId}/worker-{index}/screenshots/...
          const match = obj.Key.match(/worker-(\d+)/);
          const workerIndex = match ? parseInt(match[1]) : 0;
          
          // Extract filename
          const filename = obj.Key.split('/').pop();
          
          // Try to extract user ID from filename (e.g., "user-5-screenshot.png" or "User-5-step.png")
          const userIdMatch = filename.match(/user[_-](\d+)/i);
          const userId = userIdMatch ? parseInt(userIdMatch[1]) : null;
          
          try {
            // Generate presigned URL
            const presignedUrl = await getPresignedUrl(this.storageConfig, obj.Key, 3600);
            
            return {
              key: obj.Key,
              filename,
              workerIndex,
              userId,
              size: obj.Size,
              lastModified: obj.LastModified,
              url: presignedUrl
            };
          } catch (err) {
            console.error(`Error generating presigned URL for ${obj.Key}:`, err.message);
            // Fallback to direct URL if presigned URL generation fails
            return {
              key: obj.Key,
              filename,
              workerIndex,
              userId,
              size: obj.Size,
              lastModified: obj.LastModified,
              url: `${this.storageConfig.endpoint}/${this.storageConfig.bucket}/${obj.Key}`
            };
          }
        })
      );
      
      const sortedScreenshots = screenshots.sort((a, b) => a.workerIndex - b.workerIndex);
      
      console.log(`Found ${sortedScreenshots.length} screenshots for run ${runId} with presigned URLs`);
      return sortedScreenshots;
    } catch (error) {
      console.error('Error loading screenshots from storage:', error);
      return [];
    }
  }

  /**
   * Delete all test data for a run from S3 storage
   * @param {string} runId - Run identifier
   * @returns {Promise<Object>} Deletion results
   */
  async deleteRunData(runId) {
    try {
      const { getResultsPrefix } = require('@playwright-easyscale/shared/storagePaths');
      
      console.log(`Deleting all data for run ${runId}...`);
      
      // Delete results (screenshots, test results, etc.)
      const resultsPrefix = getResultsPrefix(runId);
      const resultsDeleted = await deleteS3ObjectsByPrefix(this.storageConfig, resultsPrefix);
      console.log(`Deleted ${resultsDeleted} objects from ${resultsPrefix}`);
      
      // Delete logs
      const logsPrefix = getLogsPrefix(runId);
      const logsDeleted = await deleteS3ObjectsByPrefix(this.storageConfig, logsPrefix);
      console.log(`Deleted ${logsDeleted} objects from ${logsPrefix}`);
      
      // Delete run metadata (includes run.json, workers/, parameters/)
      const runPrefix = `runs/${runId}`;
      const metadataDeleted = await deleteS3ObjectsByPrefix(this.storageConfig, runPrefix);
      console.log(`Deleted ${metadataDeleted} metadata objects from ${runPrefix}`);
      
      const totalDeleted = resultsDeleted + logsDeleted + metadataDeleted;
      
      return {
        runId,
        deletedCount: totalDeleted,
        results: resultsDeleted,
        logs: logsDeleted,
        metadata: metadataDeleted,
        message: `Deleted ${totalDeleted} objects for run ${runId}`
      };
    } catch (error) {
      console.error(`Error deleting data for run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Wait for all workers to become ready
   * @param {string} runId - Run identifier
   * @param {number} expectedCount - Expected number of workers
   * @param {Object} logger - Logger instance
   * @param {number} timeoutMs - Timeout in milliseconds (default: 10 minutes)
   * @returns {Promise<boolean>} True if all workers ready, throws on timeout
   */
  async waitForAllWorkersReady(runId, expectedCount, logger, timeoutMs = 600000) {
    const startTime = Date.now();
    const pollInterval = 5000; // Check every 5 seconds
    
    while (Date.now() - startTime < timeoutMs) {
      const workers = await this.getWorkers(runId);
      const readyWorkers = workers.filter(w => w.state === 'ready');
      
      if (readyWorkers.length === expectedCount) {
        // All workers ready!
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout - identify which workers failed
    const workers = await this.getWorkers(runId);
    const readyWorkers = workers.filter(w => w.state === 'ready');
    const missingWorkers = workers.filter(w => w.state !== 'ready');
    
    await logger.error(`Deployment timeout: ${missingWorkers.length} workers never became ready`, {
      event: 'deployment_timeout',
      readyCount: readyWorkers.length,
      missingCount: missingWorkers.length,
      missingWorkerIndices: missingWorkers.map(w => w.index),
      missingWorkerStates: missingWorkers.map(w => ({ index: w.index, state: w.state }))
    });
    
    throw new Error(`Deployment timeout: Workers ${missingWorkers.map(w => w.index).join(', ')} never became ready`);
  }

  /**
   * Delete test data for multiple runs in bulk
   * @param {Array<string>} runIds - Array of run identifiers
   * @returns {Promise<Array>} Array of deletion results
   */
  async bulkDeleteRunData(runIds) {
    console.log(`Bulk deleting data for ${runIds.length} runs...`);
    
    const results = await Promise.all(
      runIds.map(async runId => {
        try {
          return await this.deleteRunData(runId);
        } catch (error) {
          return {
            runId,
            error: error.message,
            deletedCount: 0
          };
        }
      })
    );
    
    const totalDeleted = results.reduce((sum, r) => sum + (r.deletedCount || 0), 0);
    console.log(`Bulk delete completed: ${totalDeleted} total objects deleted`);
    
    return results;
  }
}

module.exports = RunManager;
