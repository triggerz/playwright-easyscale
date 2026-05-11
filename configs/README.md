# Test Configurations

This directory contains test configuration files for the Playwright Scale Test orchestrator.

## Configuration Format

Each configuration file is a JSON file with the following structure:

```json
{
  "name": "Test Name",
  "totalUsers": 100,
  "usersPerContainer": 5,
  "testFile": "example.spec.js",
  "environment": {
    "LOGIN_URL": "https://example.com",
    "PASSWORD": "password123",
    "HEADLESS": "true"
  },
  "railway": {
    "projectId": "${{RAILWAY_PROJECT_ID}}",
    "serviceId": "${{RAILWAY_SERVICE_ID}}",
    "apiToken": "${RAILWAY_API_TOKEN}"
  },
  "storage": {
    "endpoint": "${S3_ENDPOINT}",
    "accessKey": "${S3_ACCESS_KEY}",
    "secretKey": "${S3_SECRET_KEY}",
    "bucket": "${S3_BUCKET}",
    "region": "${S3_REGION}"
  },
  "options": {
    "headless": true,
    "timeout": 300000,
    "retries": 0,
    "maxConcurrency": 5
  }
}
```

## Environment Variable Substitution

The configuration supports environment variable substitution using `${VAR_NAME}` syntax.

### Railway Variables

Railway-specific variables use the `${{VAR_NAME}}` syntax and are automatically provided by Railway:

- `${{RAILWAY_PROJECT_ID}}` - Your Railway project ID
- `${{RAILWAY_SERVICE_ID}}` - Your Railway service ID

### S3-Compatible Storage Variables

The storage configuration expects these environment variables for any S3-compatible storage provider:

- `S3_ENDPOINT` - S3 endpoint URL
- `S3_ACCESS_KEY` - S3 access key ID
- `S3_SECRET_KEY` - S3 secret access key
- `S3_BUCKET` - S3 bucket name
- `S3_REGION` - S3 region (optional, defaults to 'auto')

### Other Variables

- `RAILWAY_API_TOKEN` - Your Railway API token for programmatic deployments

## Setting Up Storage

This project supports any S3-compatible storage provider. Choose the one that fits your needs:

### Option 1: Railway Buckets (Recommended)

**Pros**: Native Railway integration, automatic environment isolation, free egress and API operations
**Cost**: $0.015/GB-month

1. In your Railway project, click **Create** → **Bucket**
2. Choose a region and name
3. In your orchestrator service, add these variable references:
   ```
   S3_ENDPOINT="${{Bucket.ENDPOINT}}"
   S3_ACCESS_KEY="${{Bucket.ACCESS_KEY_ID}}"
   S3_SECRET_KEY="${{Bucket.SECRET_ACCESS_KEY}}"
   S3_BUCKET="${{Bucket.BUCKET}}"
   S3_REGION="${{Bucket.REGION}}"
   ```
   (Replace "Bucket" with your bucket's name)

### Option 2: AWS S3

**Pros**: Industry standard, global availability, extensive features
**Cost**: ~$0.023/GB-month + $0.09/GB egress + API operation costs

1. Create an S3 bucket in AWS Console
2. Create an IAM user with S3 access
3. Set environment variables:
   ```
   S3_ENDPOINT="https://s3.amazonaws.com"
   S3_ACCESS_KEY="your-aws-access-key"
   S3_SECRET_KEY="your-aws-secret-key"
   S3_BUCKET="your-bucket-name"
   S3_REGION="us-east-1"
   ```

### Option 3: Cloudflare R2

**Pros**: Free egress, competitive pricing
**Cost**: $0.015/GB-month + API operation costs

1. Create an R2 bucket in Cloudflare dashboard
2. Generate API tokens
3. Set environment variables:
   ```
   S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
   S3_ACCESS_KEY="your-r2-access-key"
   S3_SECRET_KEY="your-r2-secret-key"
   S3_BUCKET="your-bucket-name"
   S3_REGION="auto"
   ```

### Option 4: Self-Hosted MinIO

**Pros**: Full control, no vendor lock-in
**Cost**: Infrastructure costs only

1. Deploy MinIO container to Railway or your own infrastructure
2. Configure endpoint and credentials
3. Set environment variables accordingly

## Configuration Fields

### Required Fields

- `name` - Human-readable test name
- `totalUsers` - Total number of users to simulate
- `usersPerContainer` - Number of users per container (determines how many containers will be created)
- `testFile` - Name of the test file in `worker/tests/` to run

### Optional Fields

- `environment` - Custom environment variables to pass to test containers
- `railway` - Railway API configuration
- `storage` - S3-compatible storage configuration for logs
- `options` - Test execution options

## Examples

See `example.json` for a basic configuration template.

## Creating Your Own Config

1. Copy `example.json` to a new file (e.g., `my-test.json`)
2. Update the test parameters
3. Set environment variables in your shell or Railway
4. Run: `node orchestrator/src/index.js --config=configs/my-test.json`

## Security Note

**Never commit configuration files with secrets to version control!**

The `.gitignore` is configured to ignore all files in this directory except:
- `example.json`
- `README.md`

Always use environment variable substitution for sensitive values.
