/**
 * Storage utilities
 * Handles S3-compatible storage operations including bucket creation
 */

const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

/**
 * Create S3 client
 * @param {Object} config - Storage configuration
 * @returns {S3Client} S3 client instance
 */
function createS3Client(config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: true // Required for MinIO and some S3-compatible services
  });
}

/**
 * Check if bucket exists
 * @param {S3Client} client - S3 client
 * @param {string} bucketName - Bucket name
 * @returns {Promise<boolean>} True if bucket exists
 */
async function bucketExists(client, bucketName) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Create bucket if it doesn't exist
 * @param {S3Client} client - S3 client
 * @param {string} bucketName - Bucket name
 * @returns {Promise<boolean>} True if bucket was created, false if it already existed
 */
async function createBucketIfNotExists(client, bucketName) {
  const exists = await bucketExists(client, bucketName);
  
  if (exists) {
    return false;
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    // If bucket already exists (race condition), that's fine
    if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
      return false;
    }
    throw error;
  }
}

/**
 * Ensure storage is ready for test run
 * @param {Object} storageConfig - Storage configuration
 * @returns {Promise<void>}
 */
async function ensureStorageReady(storageConfig) {
  const client = createS3Client(storageConfig);
  const bucketName = storageConfig.bucket;

  const created = await createBucketIfNotExists(client, bucketName);
  
  if (created) {
    console.log(`   ✓ Created bucket: ${bucketName}`);
  } else {
    console.log(`   ✓ Bucket exists: ${bucketName}`);
  }
}

module.exports = {
  createS3Client,
  bucketExists,
  createBucketIfNotExists,
  ensureStorageReady
};
