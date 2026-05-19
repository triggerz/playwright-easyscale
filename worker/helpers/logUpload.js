/**
 * Log upload utilities
 * Handles uploading logs and screenshots to S3-compatible storage
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

/**
 * Upload file to S3-compatible storage
 * @param {string} filePath - Local file path
 * @param {string} key - S3 object key
 * @param {Object} config - Storage configuration
 * @returns {Promise<void>}
 */
async function uploadFile(filePath, key, config) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: true // Required for MinIO and some S3-compatible services
  });

  const fileContent = fs.readFileSync(filePath);
  const contentType = getContentType(filePath);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: fileContent,
    ContentType: contentType
  });

  await client.send(command);
}

/**
 * Upload logs for a test run
 * @param {string} runId - Test run ID
 * @param {string} shardIndex - Container shard index
 * @param {string} logDir - Local log directory
 * @param {Object} config - Storage configuration
 * @returns {Promise<void>}
 */
async function uploadLogs(runId, shardIndex, logDir, config) {
  if (!fs.existsSync(logDir)) {
    console.log('No logs directory found, skipping upload');
    return;
  }

  // Get all files recursively
  const allFiles = getAllFiles(logDir);
  const uploadPromises = [];

  for (const filePath of allFiles) {
    const relativePath = path.relative(logDir, filePath);
    // Use logs/ prefix to match API expectations
    const key = `logs/${runId}/worker-${shardIndex}/${relativePath}`;
    
    console.log(`Uploading ${relativePath} to ${key}...`);
    uploadPromises.push(uploadFile(filePath, key, config));
  }

  await Promise.all(uploadPromises);
  console.log(`Uploaded ${allFiles.length} files to storage`);
}

/**
 * Upload screenshots
 * @param {string} runId - Test run ID
 * @param {string} shardIndex - Container shard index
 * @param {string} screenshotDir - Local screenshot directory
 * @param {Object} config - Storage configuration
 * @returns {Promise<void>}
 */
async function uploadScreenshots(runId, shardIndex, screenshotDir, config) {
  if (!fs.existsSync(screenshotDir)) {
    console.log('No screenshots directory found, skipping upload');
    return;
  }

  const files = getAllFiles(screenshotDir);
  const screenshotFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    const isImageOrVideo = ['.png', '.jpg', '.jpeg', '.gif', '.webm', '.mp4'].includes(ext);
    
    // Exclude Playwright trace resource files to avoid uploading thousands of trace snapshots
    const isTraceResource = f.includes('/.playwright-artifacts-') && f.includes('/traces/resources/');
    
    // Check file size - skip empty or tiny files (< 1KB) to avoid uploading empty videos
    const stats = fs.statSync(f);
    const isNotEmpty = stats.size > 1024; // 1KB minimum
    
    return isImageOrVideo && !isTraceResource && isNotEmpty;
  });
  
  const uploadPromises = [];

  for (const file of screenshotFiles) {
    const relativePath = path.relative(screenshotDir, file);
    // Use results/ prefix for screenshots
    const key = `results/${runId}/worker-${shardIndex}/screenshots/${relativePath}`;
    
    console.log(`Uploading screenshot ${relativePath}...`);
    uploadPromises.push(uploadFile(file, key, config));
  }

  await Promise.all(uploadPromises);
  console.log(`Uploaded ${screenshotFiles.length} screenshots to storage`);
}

/**
 * Upload test results
 * @param {string} runId - Test run ID
 * @param {string} shardIndex - Container shard index
 * @param {Object} results - Test results object
 * @param {Object} config - Storage configuration
 * @returns {Promise<void>}
 */
async function uploadTestResults(runId, shardIndex, results, config) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: true
  });

  // Use results/ prefix for test results
  const key = `results/${runId}/worker-${shardIndex}/results.json`;
  const content = JSON.stringify(results, null, 2);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: content,
    ContentType: 'application/json'
  });

  await client.send(command);
  console.log(`Uploaded test results to ${key}`);
}

/**
 * Get all files recursively from a directory
 * @param {string} dir - Directory path
 * @returns {Array<string>} Array of file paths
 */
function getAllFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Get content type based on file extension
 * @param {string} filePath - File path
 * @returns {string} Content type
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.json': 'application/json',
    '.log': 'text/plain',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4'
  };

  return contentTypes[ext] || 'application/octet-stream';
}

module.exports = {
  uploadFile,
  uploadLogs,
  uploadScreenshots,
  uploadTestResults
};
