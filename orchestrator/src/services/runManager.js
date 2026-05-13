/**
 * Run Manager - Manages test run lifecycle
 */

const crypto = require('crypto');
const { calculateDistribution, generateContainerEnv } = require('../distributor');
const RailwayClient = require('../railway');
const { uploadJSON, downloadJSON, listS3Objects } = require('@playwright-easyscale/shared/s3Operations');
const { 
  getRunMetadataPath, 
  getUserParametersPath, 
  getWorkerStatusPath,
  getWorkersPrefix,
  getRunsPrefix,
  getLogsPrefix
} = require('@playwright-easyscale/shared/storagePaths');
const { safeJSONParse, parseJSONLines } = require('@playwright-easyscale/shared/jsonHelpers');

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
      await uploadJSON(
        this.storageConfig,
        getUserParametersPath(runId, i),
        config.parameters || {}
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
    const runMetadata = await this.getRun(runId);
    if (!runMetadata) {
      throw new Error(`Run ${runId} not found`);
    }

    const railway = new RailwayClient(railwayConfig.apiToken);
    const deployments = [];
    const spawnedServices = [];

    // Update status to deploying
    await this.updateRunStatus(runId, 'deploying');

    console.log(`Deploying ${runMetadata.containers.length} worker containers for run ${runId}`);

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

        console.log(`Spawning worker ${workerName} for users ${container.startUser}-${container.endUser}`);

        // Spawn a new worker service
        const workerService = await railway.spawnWorker(
          railwayConfig.projectId,
          railwayConfig.environmentId,
          workerName,
          railwayVariables
        );

        spawnedServices.push(workerService.serviceId);

        deployments.push({
          container,
          serviceId: workerService.serviceId,
          serviceName: workerService.serviceName,
          status: workerService.status
        });

        // Store initial worker status in S3
        await this.updateWorkerStatus(runId, container.index, {
          index: container.index,
          startUser: container.startUser,
          endUser: container.endUser,
          userCount: container.userCount,
          status: 'deploying',
          serviceId: workerService.serviceId,
          serviceName: workerService.serviceName,
          startedAt: new Date().toISOString()
        });

        // Delay between spawning workers to avoid overwhelming Railway API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error spawning worker for container ${container.index}:`, error);
        
        // Clean up any services that were created before the error
        console.log('Cleaning up spawned services due to error...');
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
      spawnedServices 
    });

    console.log(`Successfully spawned ${deployments.length} workers for run ${runId}`);
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
      
      const runs = await Promise.all(
        objects
          .filter(obj => obj.Key.endsWith('.json') && !obj.Key.includes('/'))
          .map(async obj => await downloadJSON(this.storageConfig, obj.Key))
      );
      
      return runs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
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
   * Send start signal to all workers
   * @param {string} runId - Run identifier
   */
  async startRun(runId) {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    console.log(`Sending start signal to run ${runId}`);
    
    // Write control signal to S3
    const { uploadJSON } = require('@playwright-easyscale/shared/s3Operations');
    const { getRunControlPath } = require('@playwright-easyscale/shared/storagePaths');
    
    await uploadJSON(
      this.storageConfig,
      getRunControlPath(runId),
      {
        signal: 'start',
        timestamp: new Date().toISOString()
      }
    );
    
    await this.updateRunStatus(runId, 'running', {
      startedAt: new Date().toISOString()
    });
    
    console.log(`Start signal sent to run ${runId}`);
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
        status: 'deleted',
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
   * Stop a run by sending stop signal to workers
   * @param {string} runId - Run identifier
   */
  async stopRun(runId) {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    console.log(`Sending stop signal to run ${runId}`);
    
    // Write stop signal to S3
    const { uploadJSON } = require('@playwright-easyscale/shared/s3Operations');
    const { getRunControlPath } = require('@playwright-easyscale/shared/storagePaths');
    
    await uploadJSON(
      this.storageConfig,
      getRunControlPath(runId),
      {
        signal: 'stop',
        timestamp: new Date().toISOString()
      }
    );
    
    await this.updateRunStatus(runId, 'stopped', {
      stoppedAt: new Date().toISOString()
    });
    
    console.log(`Stop signal sent to run ${runId}`);
  }

  /**
   * Reset a run by clearing stop signal and resetting workers to ready
   * @param {string} runId - Run identifier
   */
  async resetRun(runId) {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    console.log(`Resetting run ${runId}`);
    
    // Clear control signal
    const { uploadJSON } = require('@playwright-easyscale/shared/s3Operations');
    const { getRunControlPath } = require('@playwright-easyscale/shared/storagePaths');
    
    await uploadJSON(
      this.storageConfig,
      getRunControlPath(runId),
      {
        signal: 'reset',
        timestamp: new Date().toISOString()
      }
    );
    
    // Reset all workers to ready status
    const workers = await this.getWorkers(runId);
    for (const worker of workers) {
      await this.updateWorkerStatus(runId, worker.index, {
        ...worker,
        status: 'ready',
        resetAt: new Date().toISOString()
      });
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
          
          // Parse log content (assuming JSON lines format)
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
      
      return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
      console.error('Error loading logs from storage:', error);
      return [];
    }
  }
}

module.exports = RunManager;
