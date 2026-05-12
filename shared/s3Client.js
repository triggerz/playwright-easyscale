/**
 * Shared S3 Client Utilities
 * Used by both orchestrator and worker for consistent S3 operations
 */

const { S3Client } = require('@aws-sdk/client-s3');

let cachedClient = null;
let cachedConfig = null;

/**
 * Create S3 client with configuration
 * @param {Object} config - Storage configuration
 * @returns {S3Client} S3 client instance
 */
function createS3Client(config) {
  // Return cached client if config hasn't changed
  if (cachedClient && JSON.stringify(cachedConfig) === JSON.stringify(config)) {
    return cachedClient;
  }

  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: true // Required for MinIO and some S3-compatible services
  });

  cachedConfig = config;
  return cachedClient;
}

/**
 * Get storage configuration from environment variables
 * @returns {Object} Storage configuration
 */
function getStorageConfigFromEnv() {
  return {
    endpoint: process.env.STORAGE_ENDPOINT || process.env.S3_ENDPOINT,
    accessKey: process.env.STORAGE_ACCESS_KEY || process.env.S3_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY || process.env.S3_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || process.env.S3_BUCKET,
    region: process.env.STORAGE_REGION || process.env.S3_REGION || 'auto'
  };
}

/**
 * Convert S3 response stream to string
 * @param {ReadableStream} stream - S3 response body stream
 * @returns {Promise<string>} Content as string
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

module.exports = {
  createS3Client,
  getStorageConfigFromEnv,
  streamToString
};
