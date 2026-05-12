/**
 * Shared S3 Operations
 * Common upload, download, and list operations for S3 storage
 */

const { GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { createS3Client, streamToString } = require('./s3Client');

/**
 * Upload content to S3 storage
 * @param {Object} config - Storage configuration
 * @param {string} key - Object key (path)
 * @param {string|Buffer} content - Content to upload
 * @param {string} contentType - Content type (default: 'application/json')
 * @returns {Promise<void>}
 */
async function uploadToS3(config, key, content, contentType = 'application/json') {
  const client = createS3Client(config);
  
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: content,
    ContentType: contentType
  }));
}

/**
 * Download content from S3 storage
 * @param {Object} config - Storage configuration
 * @param {string} key - Object key (path)
 * @returns {Promise<string>} Content as string
 */
async function downloadFromS3(config, key) {
  const client = createS3Client(config);
  
  const response = await client.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key
  }));

  return await streamToString(response.Body);
}

/**
 * List objects in S3 storage with a prefix
 * @param {Object} config - Storage configuration
 * @param {string} prefix - Key prefix to filter by
 * @returns {Promise<Array>} Array of objects
 */
async function listS3Objects(config, prefix = '') {
  const client = createS3Client(config);
  
  const response = await client.send(new ListObjectsV2Command({
    Bucket: config.bucket,
    Prefix: prefix
  }));

  return response.Contents || [];
}

/**
 * Upload JSON object to S3
 * @param {Object} config - Storage configuration
 * @param {string} key - Object key (path)
 * @param {Object} data - Data to upload as JSON
 * @param {boolean} pretty - Whether to pretty-print JSON (default: true)
 * @returns {Promise<void>}
 */
async function uploadJSON(config, key, data, pretty = true) {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await uploadToS3(config, key, content, 'application/json');
}

/**
 * Download and parse JSON from S3
 * @param {Object} config - Storage configuration
 * @param {string} key - Object key (path)
 * @returns {Promise<Object>} Parsed JSON object
 */
async function downloadJSON(config, key) {
  const content = await downloadFromS3(config, key);
  return JSON.parse(content);
}

module.exports = {
  uploadToS3,
  downloadFromS3,
  listS3Objects,
  uploadJSON,
  downloadJSON
};
