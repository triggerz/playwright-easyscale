/**
 * Shared S3 Operations
 * Common upload, download, and list operations for S3 storage
 */

const { GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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

/**
 * Generate a presigned URL for temporary access to an S3 object
 * @param {Object} config - Storage configuration
 * @param {string} key - Object key (path)
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
async function getPresignedUrl(config, key, expiresIn = 3600) {
  const client = createS3Client(config);
  
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete objects from S3 storage by prefix
 * Deletes all objects that start with the given prefix
 * @param {Object} config - Storage configuration
 * @param {string} prefix - Key prefix to filter objects to delete
 * @returns {Promise<number>} Number of objects deleted
 */
async function deleteS3ObjectsByPrefix(config, prefix) {
  const client = createS3Client(config);
  let deletedCount = 0;
  let continuationToken = null;

  do {
    // List objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    });

    const listResponse = await client.send(listCommand);
    const objects = listResponse.Contents || [];

    if (objects.length === 0) {
      break;
    }

    // Delete objects in batches (S3 allows up to 1000 per request)
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: objects.map(obj => ({ Key: obj.Key })),
        Quiet: true
      }
    });

    await client.send(deleteCommand);
    deletedCount += objects.length;

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return deletedCount;
}

module.exports = {
  uploadToS3,
  downloadFromS3,
  listS3Objects,
  uploadJSON,
  downloadJSON,
  getPresignedUrl,
  deleteS3ObjectsByPrefix
};
