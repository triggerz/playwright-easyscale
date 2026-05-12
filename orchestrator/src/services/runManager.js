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
   * Deploy containers for a run
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

    // Update status to deploying
    await this.updateRunStatus(runId, 'deploying');

    for (const container of runMetadata.containers) {
      try {
        // Generate environment variables for this container
        const env = {
          ...generateContainerEnv(container, {
            storage: railwayConfig.storage,
            testFile: runMetadata.testFile
          }, runId),
          TEST_FILE: runMetadata.testFile,
          RUN_ID: runId
        };

        // Deploy to Railway
        const deployment = await railway.deployService(
          railwayConfig.projectId,
          railwayConfig.serviceId,
          env
        );

        deployments.push({
          container,
          deployment
        });

        // Store initial worker status in S3
        await this.updateWorkerStatus(runId, container.index, {
          index: container.index,
          startUser: container.startUser,
          endUser: container.endUser,
          userCount: container.userCount,
          status: 'pending',
          deploymentId: deployment.deploymentId,
          startedAt: new Date().toISOString()
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error deploying container ${container.index}:`, error);
        throw error;
      }
    }

    // Update status to running
    await this.updateRunStatus(runId, 'running', { deployments });

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
   * Stop a run
   * @param {string} runId - Run identifier
   */
  async stopRun(runId) {
    await this.updateRunStatus(runId, 'stopped', {
      stoppedAt: new Date().toISOString()
    });

    // TODO: Implement actual container stopping via Railway API
    // For now, just update the status
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
