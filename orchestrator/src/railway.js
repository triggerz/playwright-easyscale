/**
 * Railway API client
 * Handles deployment and management of containers on Railway
 */

const axios = require('axios');

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://backboard.railway.app/graphql/v2';

/**
 * Railway API client
 */
class RailwayClient {
  constructor(apiToken, apiUrl = null) {
    this.apiToken = apiToken;
    this.apiUrl = apiUrl || RAILWAY_API_URL;
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Execute GraphQL query
   * @param {string} query - GraphQL query
   * @param {Object} variables - Query variables
   * @returns {Promise<Object>} Response data
   */
  async query(query, variables = {}) {
    try {
      const response = await this.client.post('', {
        query,
        variables
      });

      if (response.data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Railway API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Create a new service (duplicate worker)
   * @param {string} projectId - Railway project ID
   * @param {string} name - Service name
   * @returns {Promise<Object>} Created service info
   */
  async createService(projectId, name) {
    const mutation = `
      mutation serviceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
          icon
          templateId
          templateServiceId
          createdAt
          projectId
          featureFlags
          templateThreadSlug
          hasHiddenRegistryCredentialsFromTemplate
        }
      }
    `;

    const data = await this.query(mutation, {
      input: {
        name: name,
        icon: null,
        projectId: projectId,
        environmentId: null,
        templateServiceId: null,
        templateId: null
      }
    });

    console.log(`Created service: ${data.serviceCreate.name} (${data.serviceCreate.id})`);
    return data.serviceCreate;
  }

  /**
   * Stage service configuration for an environment
   * @param {string} environmentId - Railway environment ID
   * @param {string} serviceId - Railway service ID
   * @param {Object} config - Service configuration
   * @returns {Promise<Object>} Staged changes info
   */
  async stageServiceConfiguration(environmentId, serviceId, config) {
    const mutation = `
      mutation stageEnvironmentChanges($environmentId: String!, $payload: EnvironmentConfig!, $merge: Boolean) {
        environmentStageChanges(
          environmentId: $environmentId
          input: $payload
          merge: $merge
        ) {
          id
        }
      }
    `;

    // Build the payload structure
    const payload = {
      services: {
        [serviceId]: {
          isCreated: true,
          source: config.source || {
            repo: "triggerz/playwright-easyscale-the-key",
            branch: "master",
            rootDirectory: "",
            checkSuites: false
          },
          variables: config.variables || {},
          build: config.build || {
            builder: "RAILPACK",
            buildEnvironment: "V3"
          },
          deploy: config.deploy || {
            useLegacyStacker: false,
            ipv6EgressEnabled: false,
            runtime: "V2",
            multiRegionConfig: {
              "europe-west4-drams3a": {
                numReplicas: 1
              }
            }
          }
        }
      }
    };

    const data = await this.query(mutation, {
      environmentId: environmentId,
      payload: payload,
      merge: true
    });

    console.log(`Staged configuration for service ${serviceId} in environment ${environmentId}`);
    return data.environmentStageChanges;
  }

  /**
   * Commit staged changes and trigger deployment
   * @param {string} environmentId - Railway environment ID
   * @param {boolean} skipDeploys - Whether to skip automatic deployment
   * @returns {Promise<boolean>} Success status
   */
  async commitStagedChanges(environmentId, skipDeploys = false) {
    const mutation = `
      mutation environmentPatchCommitStaged($environmentId: String!, $message: String, $skipDeploys: Boolean) {
        environmentPatchCommitStaged(
          environmentId: $environmentId
          commitMessage: $message
          skipDeploys: $skipDeploys
        )
      }
    `;

    const data = await this.query(mutation, {
      environmentId: environmentId,
      message: null,
      skipDeploys: skipDeploys
    });

    console.log(`Committed staged changes for environment ${environmentId}`);
    return data.environmentPatchCommitStaged;
  }

  /**
   * Spawn a new worker service with specific configuration (with retry logic)
   * @param {string} projectId - Railway project ID
   * @param {string} environmentId - Railway environment ID
   * @param {string} workerName - Name for the worker service
   * @param {Object} environmentVariables - Environment variables for the worker
   * @param {Object} sourceConfig - Source repository configuration
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @returns {Promise<Object>} Worker service info
   */
  async spawnWorker(projectId, environmentId, workerName, environmentVariables, sourceConfig = null, maxRetries = 3) {
    let lastError = null;
    let createdServiceId = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Spawning worker: ${workerName} (attempt ${attempt}/${maxRetries})`);
        
        // Step 1: Create the service
        const service = await this.createService(projectId, workerName);
        if (!service || !service.id) {
          throw new Error('Service creation failed - no service ID returned');
        }
        createdServiceId = service.id;
        
        // Step 2: Stage the configuration
        const config = {
          source: sourceConfig || {
            repo: "triggerz/playwright-easyscale-the-key",
            branch: "master",
            rootDirectory: "",
            checkSuites: false
          },
          variables: {
            ...environmentVariables,
            RAILWAY_DOCKERFILE_PATH: { value: "/worker/Dockerfile" }
          },
          build: {
            builder: "RAILPACK",
            buildEnvironment: "V3"
          },
          deploy: {
            useLegacyStacker: false,
            ipv6EgressEnabled: false,
            runtime: "V2",
            multiRegionConfig: {
              "europe-west4-drams3a": {
                numReplicas: 1
              }
            }
          }
        };
        
        const staged = await this.stageServiceConfiguration(environmentId, service.id, config);
        if (!staged || !staged.id) {
          throw new Error('Failed to stage configuration - no staged changes ID returned');
        }
        
        // Step 3: Commit and deploy
        const commitId = await this.commitStagedChanges(environmentId, false);
        if (!commitId) {
          throw new Error('Failed to commit staged changes - no commit ID returned');
        }
        
        // Step 4: Verify service exists
        const verifiedService = await this.getService(service.id);
        if (!verifiedService || !verifiedService.id) {
          throw new Error(`Service ${service.id} not found after creation - verification failed`);
        }
        
        console.log(`Worker ${workerName} spawned and verified successfully`);
        return {
          serviceId: service.id,
          serviceName: service.name,
          commitId: commitId,
          status: 'DEPLOYING',
          attempt: attempt
        };
        
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt}/${maxRetries} failed for ${workerName}:`, error.message);
        
        // Clean up the service if it was created but subsequent steps failed
        if (createdServiceId) {
          try {
            console.log(`Cleaning up failed service ${createdServiceId}...`);
            await this.deleteService(createdServiceId);
            createdServiceId = null;
          } catch (cleanupError) {
            console.error(`Failed to cleanup service ${createdServiceId}:`, cleanupError.message);
          }
        }
        
        // If this wasn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delayMs = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // All retries failed
    throw new Error(`Failed to spawn worker ${workerName} after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Get service information
   * @param {string} serviceId - Service ID
   * @returns {Promise<Object>} Service information
   */
  async getService(serviceId) {
    const query = `
      query service($id: String!) {
        service(id: $id) {
          id
          name
          createdAt
          projectId
        }
      }
    `;

    const data = await this.query(query, { id: serviceId });
    return data.service;
  }

  /**
   * Delete a service
   * @param {string} serviceId - Service ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteService(serviceId) {
    const mutation = `
      mutation serviceDelete($id: String!) {
        serviceDelete(id: $id)
      }
    `;

    const data = await this.query(mutation, { id: serviceId });
    console.log(`Deleted service ${serviceId}`);
    return data.serviceDelete;
  }

  /**
   * Get deployment status
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Deployment status
   */
  async getDeploymentStatus(deploymentId) {
    const query = `
      query Deployment($id: String!) {
        deployment(id: $id) {
          id
          status
          createdAt
          completedAt
        }
      }
    `;

    const data = await this.query(query, { id: deploymentId });
    return data.deployment;
  }

  /**
   * Get service logs
   * @param {string} deploymentId - Deployment ID
   * @param {number} limit - Number of log lines
   * @returns {Promise<Array>} Log lines
   */
  async getDeploymentLogs(deploymentId, limit = 100) {
    const query = `
      query DeploymentLogs($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          message
          timestamp
        }
      }
    `;

    const data = await this.query(query, { deploymentId, limit });
    return data.deploymentLogs || [];
  }

  /**
   * Delete a deployment
   * @param {string} deploymentId - Deployment ID
   */
  async deleteDeployment(deploymentId) {
    const mutation = `
      mutation DeploymentRemove($id: String!) {
        deploymentRemove(id: $id)
      }
    `;

    await this.query(mutation, { id: deploymentId });
  }

  /**
   * Wait for deployment to complete
   * @param {string} deploymentId - Deployment ID
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Final deployment status
   */
  async waitForDeployment(deploymentId, timeoutMs = 600000, onProgress = null) {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getDeploymentStatus(deploymentId);

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'SUCCESS' || status.status === 'COMPLETED') {
        return status;
      }

      if (status.status === 'FAILED' || status.status === 'CRASHED') {
        throw new Error(`Deployment failed with status: ${status.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Deployment timeout after ${timeoutMs}ms`);
  }
}

module.exports = RailwayClient;
