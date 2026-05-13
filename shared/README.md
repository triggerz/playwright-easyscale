# Shared Utilities

This directory contains shared utilities used by both the orchestrator and worker components of Playwright EasyScale.

## Purpose

By centralizing common functionality, we:
- **Reduce code duplication** (~150 lines eliminated)
- **Ensure consistency** between orchestrator and worker
- **Simplify maintenance** - changes in one place
- **Improve testability** - shared code easier to unit test

## Modules

### `s3Client.js`
S3 client creation and configuration management.

**Exports:**
- `createS3Client(config)` - Create/cache S3 client
- `getStorageConfigFromEnv()` - Build config from environment variables
- `streamToString(stream)` - Convert S3 response stream to string

### `s3Operations.js`
Common S3 upload, download, and list operations.

**Exports:**
- `uploadToS3(config, key, content, contentType)` - Upload content
- `downloadFromS3(config, key)` - Download content
- `listS3Objects(config, prefix)` - List objects with prefix
- `uploadJSON(config, key, data, pretty)` - Upload JSON object
- `downloadJSON(config, key)` - Download and parse JSON

### `storagePaths.js`
Centralized S3 key path generation.

**Exports:**
- `getRunMetadataPath(runId)` - Path for run metadata
- `getUserParametersPath(runId, userIndex)` - Path for user parameters
- `getWorkerStatusPath(runId, workerIndex)` - Path for worker status
- `getWorkersPrefix(runId)` - Prefix for all workers
- `getParametersPrefix(runId)` - Prefix for all parameters
- `getRunsPrefix()` - Prefix for all runs
- `getLogsPrefix(runId)` - Prefix for logs
- `getWorkerLogPath(runId, workerIndex)` - Path for worker log
- `getResultsPrefix(runId)` - Prefix for results

### `jsonHelpers.js`
Safe JSON operations with error handling.

**Exports:**
- `safeJSONParse(jsonString, defaultValue)` - Parse with fallback
- `safeJSONStringify(data, pretty, defaultValue)` - Stringify with fallback
- `parseJSONLines(content)` - Parse JSON lines format
- `mergeJSON(...objects)` - Merge multiple objects

## Usage

### In Orchestrator

```javascript
const { uploadJSON, downloadJSON, getUserParametersPath } = require('../../shared/s3Operations');
const { getStorageConfigFromEnv } = require('../../shared/s3Client');

const config = getStorageConfigFromEnv();
await uploadJSON(config, getUserParametersPath(runId, 1), { foo: 'bar' });
```

### In Worker

```javascript
const { downloadJSON, getUserParametersPath } = require('../../shared/s3Operations');
const { getStorageConfigFromEnv } = require('../../shared/s3Client');

const config = getStorageConfigFromEnv();
const params = await downloadJSON(config, getUserParametersPath(runId, userIndex));
```

## Benefits

1. **DRY Principle** - Don't Repeat Yourself
2. **Single Source of Truth** - Path generation in one place
3. **Type Safety** - Consistent function signatures
4. **Error Handling** - Centralized error handling logic
5. **Future-Proofing** - Easy to swap S3 provider or add caching

## Testing

Shared utilities should be unit tested independently to ensure reliability across both orchestrator and worker components.

## Dependencies

- `@aws-sdk/client-s3` - AWS SDK for S3 operations

## Environment Variables

The shared utilities expect these environment variables:

- `S3_ENDPOINT` - S3 endpoint URL
- `S3_ACCESS_KEY` - S3 access key
- `S3_SECRET_KEY` - S3 secret key
- `S3_BUCKET` - S3 bucket name
- `S3_REGION` - S3 region (default: 'auto')
