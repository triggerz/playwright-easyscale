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
   * Deploy a service with environment variables
   * @param {string} environmentId - Railway environment ID
   * @param {string} serviceId - Railway service ID
   * @param {Object} environmentVariables - Environment variables
   * @returns {Promise<Object>} Deployment info
   */
  async deployService(environmentId, serviceId, environmentVariables) {
    // First, update environment variables
    await this.updateEnvironmentVariables(environmentId, serviceId, environmentVariables);

    // Then trigger a deployment using the correct mutation
    const mutation = `
      mutation ServiceInstanceRedeploy($environmentId: String!, $serviceId: String!) {
        serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
      }
    `;

    const data = await this.query(mutation, {
      environmentId: environmentId,
      serviceId: serviceId
    });

    return {
      deploymentId: data.serviceInstanceRedeploy,
      status: 'DEPLOYING'
    };
  }

  /**
   * Update environment variables for a service
   * @param {string} environmentId - Railway environment ID
   * @param {string} serviceId - Railway service ID
   * @param {Object} variables - Environment variables as key-value pairs
   */
  async updateEnvironmentVariables(environmentId, serviceId, variables) {
    // Railway API v2 requires setting variables individually
    const mutation = `
      mutation VariableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input)
      }
    `;

    // Set each variable individually
    for (const [key, value] of Object.entries(variables)) {
      const input = {
        environmentId: environmentId,
        serviceId: serviceId,
        name: key,
        value: String(value) // Ensure value is a string
      };

      try {
        await this.query(mutation, { input });
      } catch (error) {
        // Log the error but continue with other variables
        console.error(`Failed to set variable ${key}:`, error.message);
        throw error; // Re-throw to stop deployment if variable setting fails
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
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
