/**
 * Redis/Valkey client for storing test parameters and run metadata
 */

const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Connect to Redis/Valkey
   */
  async connect() {
    if (this.isConnected) return;

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      }
    });

    this.client.on('connect', () => {
      console.log('✓ Connected to Redis/Valkey');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
      this.isConnected = false;
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      this.client.once('ready', resolve);
      this.client.once('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
    });
  }

  /**
   * Store test parameters for a specific test instance
   * @param {string} runId - Run identifier
   * @param {number} testIndex - Test index (1-based)
   * @param {Object} parameters - Test parameters
   */
  async setTestParameters(runId, testIndex, parameters) {
    const key = `test:${runId}:${testIndex}`;
    await this.client.set(key, JSON.stringify(parameters), 'EX', 3600); // 1 hour TTL
  }

  /**
   * Get test parameters for a specific test instance
   * @param {string} runId - Run identifier
   * @param {number} testIndex - Test index (1-based)
   * @returns {Object} Test parameters
   */
  async getTestParameters(runId, testIndex) {
    const key = `test:${runId}:${testIndex}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Store run metadata
   * @param {string} runId - Run identifier
   * @param {Object} metadata - Run metadata
   */
  async setRunMetadata(runId, metadata) {
    const key = `run:${runId}`;
    await this.client.set(key, JSON.stringify(metadata), 'EX', 7200); // 2 hours TTL
  }

  /**
   * Get run metadata
   * @param {string} runId - Run identifier
   * @returns {Object} Run metadata
   */
  async getRunMetadata(runId) {
    const key = `run:${runId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update run metadata (merge with existing)
   * @param {string} runId - Run identifier
   * @param {Object} updates - Partial metadata to update
   */
  async updateRunMetadata(runId, updates) {
    const existing = await this.getRunMetadata(runId);
    if (!existing) {
      throw new Error(`Run ${runId} not found`);
    }
    const updated = { ...existing, ...updates };
    await this.setRunMetadata(runId, updated);
  }

  /**
   * Store worker status
   * @param {string} runId - Run identifier
   * @param {number} containerIndex - Container index
   * @param {Object} status - Worker status
   */
  async setWorkerStatus(runId, containerIndex, status) {
    const key = `worker:${runId}:${containerIndex}`;
    await this.client.set(key, JSON.stringify(status), 'EX', 3600); // 1 hour TTL
  }

  /**
   * Get worker status
   * @param {string} runId - Run identifier
   * @param {number} containerIndex - Container index
   * @returns {Object} Worker status
   */
  async getWorkerStatus(runId, containerIndex) {
    const key = `worker:${runId}:${containerIndex}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get all worker statuses for a run
   * @param {string} runId - Run identifier
   * @returns {Array} Array of worker statuses
   */
  async getAllWorkerStatuses(runId) {
    const pattern = `worker:${runId}:*`;
    const keys = await this.client.keys(pattern);
    
    if (keys.length === 0) return [];

    const values = await this.client.mget(keys);
    return values.map((val, idx) => ({
      key: keys[idx],
      ...JSON.parse(val)
    }));
  }

  /**
   * Store test parameters in bulk for all tests in a run
   * @param {string} runId - Run identifier
   * @param {Array} parametersArray - Array of parameters for each test
   */
  async setAllTestParameters(runId, parametersArray) {
    const pipeline = this.client.pipeline();
    
    parametersArray.forEach((params, index) => {
      const key = `test:${runId}:${index + 1}`;
      pipeline.set(key, JSON.stringify(params), 'EX', 3600);
    });

    await pipeline.exec();
  }

  /**
   * Clean up all data for a run
   * @param {string} runId - Run identifier
   */
  async cleanupRun(runId) {
    const patterns = [
      `test:${runId}:*`,
      `run:${runId}`,
      `worker:${runId}:*`
    ];

    for (const pattern of patterns) {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getRedisClient: () => {
    if (!instance) {
      instance = new RedisClient();
    }
    return instance;
  },
  RedisClient
};
