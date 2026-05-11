# Railway Setup Guide - Condensed

Quick reference for deploying Playwright EasyScale on Railway.

---

## 🚀 Services Overview

This project uses **2 services**:

1. **Worker** - Playwright test runner (deployed dynamically by orchestrator)
2. **Orchestrator** - Runs locally on your machine (NOT deployed to Railway)

---

## 📦 Service 1: Worker (Railway)

### Root Directory
```
worker/
```

### Environment Variables

**Required (Auto-set by Railway Template):**
```bash
# Storage (S3-compatible)
S3_ENDPOINT=<your-s3-endpoint>
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>
S3_BUCKET=<your-bucket-name>
S3_REGION=<region>

# Railway API (for orchestrator to deploy containers)
RAILWAY_PROJECT_ID=<your-project-id>
RAILWAY_SERVICE_ID=<worker-service-id>
RAILWAY_API_TOKEN=<your-api-token>
```

**Dynamic (Set by orchestrator per deployment):**
```bash
USER_RANGE_START=1          # Start of user range for this container
USER_RANGE_END=5            # End of user range for this container
RUN_ID=<unique-run-id>      # Unique identifier for this test run

# Storage credentials (for uploading results)
STORAGE_ENDPOINT=<your-s3-endpoint>
STORAGE_ACCESS_KEY=<your-access-key>
STORAGE_SECRET_KEY=<your-secret-key>
STORAGE_BUCKET=<your-bucket-name>
STORAGE_REGION=<region>
```

**Note:** All test-specific configuration (URLs, credentials, test behavior) should be defined in your test file (`worker/tests/*.spec.js`), not as environment variables. This makes tests self-contained and easier to maintain.

### Start Command
```bash
npm test
```

**What it does:**
1. Runs `playwright test` (executes tests for assigned user range)
2. Runs `node upload-results.js` (uploads logs/screenshots to S3)

### Build Configuration
- **Dockerfile:** `worker/Dockerfile`
- **Base Image:** `mcr.microsoft.com/playwright:v1.48.2-focal`
- **Node Version:** 18+
- **Auto-installs:** Playwright browsers + dependencies

### Important Notes
- ✅ Worker is deployed **dynamically** by orchestrator (not always running)
- ✅ Each deployment creates N containers based on `totalUsers / usersPerContainer`
- ✅ Containers auto-shutdown after tests complete
- ✅ Logs/results uploaded to S3 before shutdown
- ⚠️ Manual cleanup required if containers fail (no auto-cleanup yet)

---

## 💻 Service 2: Orchestrator (Local)

### Root Directory
```
orchestrator/
```

### Environment Variables

**Required (from Railway):**
```bash
RAILWAY_PROJECT_ID=<your-project-id>
RAILWAY_SERVICE_ID=<worker-service-id>
RAILWAY_API_TOKEN=<your-api-token>

# Storage credentials (same as worker)
S3_ENDPOINT=<your-s3-endpoint>
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>
S3_BUCKET=<your-bucket-name>
S3_REGION=<region>
```

**Note:** These are typically stored in your config file (`configs/*.json`) using `${VAR_NAME}` syntax.

### Start Command
```bash
npm start
```

Or with custom config:
```bash
node src/index.js --config=../configs/your-config.json
```

**Options:**
- `--config=<path>` - Path to config file (required)
- `--dry-run` - Preview distribution without deploying

### Important Notes
- ❌ **NOT deployed to Railway** - runs on your local machine
- ✅ Orchestrates worker deployments via Railway API
- ✅ Calculates user distribution across containers
- ✅ Automatically creates S3 bucket if needed
- ✅ Monitors deployment status
- ✅ Aggregates results from S3

---

## 🗂️ Storage Setup (S3-Compatible)

### Recommended: Railway Buckets
- Built-in S3-compatible storage
- Auto-configured with template deployment
- No external service needed
- **Bucket is created automatically by orchestrator**

### Alternative: AWS S3, Cloudflare R2, MinIO, etc.
Any S3-compatible storage works.

### Bucket Structure (Auto-created)
```
your-bucket/
├── run-abc123/
│   ├── container-1/
│   │   ├── results.json
│   │   └── screenshots/
│   ├── container-2/
│   │   ├── results.json
│   │   └── screenshots/
│   └── ...
└── run-def456/
    └── ...
```

**Note:** You don't need to manually create the bucket. The orchestrator will create it automatically on first run.

---

## ⚙️ Configuration File

### Location
```
configs/your-test.json
```

### Template
```json
{
  "name": "My Test",
  "totalUsers": 100,
  "usersPerContainer": 5,
  "testFile": "my-test.spec.js",
  
  "railway": {
    "projectId": "${RAILWAY_PROJECT_ID}",
    "serviceId": "${RAILWAY_SERVICE_ID}",
    "apiToken": "${RAILWAY_API_TOKEN}"
  },
  
  "storage": {
    "endpoint": "${S3_ENDPOINT}",
    "accessKey": "${S3_ACCESS_KEY}",
    "secretKey": "${S3_SECRET_KEY}",
    "bucket": "${S3_BUCKET}",
    "region": "${S3_REGION}"
  }
}
```

### Key Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `totalUsers` | Total number of users to simulate | `100` |
| `usersPerContainer` | Users per Railway container | `5` (= 20 containers) |
| `testFile` | Test file in `worker/tests/` | `my-test.spec.js` |

**Note:** Test-specific configuration (URLs, credentials, timeouts, etc.) should be defined directly in your test file, not in this config. See `worker/tests/complete-example.spec.js` for a full example.

---

## 🚀 Deployment Workflow

### 1. One-Time Setup
```bash
# Deploy Railway template (creates worker service + storage)
# Click: https://railway.app/deploy/playwright-easyscale

# Eject to your own repo (in Railway dashboard)
# Settings > Source Repo > Eject

# Clone your fork
git clone https://github.com/YOUR_USERNAME/playwright-easyscale.git
cd playwright-easyscale

# Install dependencies
cd orchestrator && npm install
cd ../worker && npm install
```

### 2. Write Tests
```bash
# Copy the complete example
cp worker/tests/complete-example.spec.js worker/tests/my-test.spec.js

# Edit the CONFIG object at the top of the file
# Customize URLs, credentials, and test steps for your application
```

### 3. Create Config
```bash
# Copy example config
cp configs/example.json configs/my-test.json

# Edit with your settings:
# - Update testFile to "my-test.spec.js"
# - Adjust totalUsers and usersPerContainer
# - Railway and storage credentials use ${VAR_NAME} syntax
```

### 4. Test Locally (Optional)
```bash
# Test single test logic
cd worker
npx playwright test tests/my-test.spec.js --headed
```

### 5. Dry Run
```bash
# Preview distribution plan
cd orchestrator
npm run dev
# or
node src/index.js --config=../configs/my-test.json --dry-run
```

### 6. Deploy to Railway
```bash
# Deploy N containers
npm start
# or
node src/index.js --config=../configs/my-test.json
```

### 7. Monitor
- **Railway Dashboard:** Real-time container logs
- **S3 Bucket:** Download results after completion
- **Orchestrator Logs:** `orchestrator/logs/orchestrator-{runId}.log`

---

## 📊 Distribution Example

**Config:**
```json
{
  "totalUsers": 100,
  "usersPerContainer": 5
}
```

**Result:** 20 containers deployed

| Container | User Range | Env Vars |
|-----------|------------|----------|
| 1 | 1-5 | `USER_RANGE_START=1 USER_RANGE_END=5` |
| 2 | 6-10 | `USER_RANGE_START=6 USER_RANGE_END=10` |
| 3 | 11-15 | `USER_RANGE_START=11 USER_RANGE_END=15` |
| ... | ... | ... |
| 20 | 96-100 | `USER_RANGE_START=96 USER_RANGE_END=100` |

---

## 💰 Cost Estimation

Railway charges per second of container runtime.

**Example:**
- 100 users
- 5 users per container = 20 containers
- 2 minutes per test
- Railway: ~$0.000008/second per container

**Cost:** 20 containers × 120 seconds × $0.000008 = **~$0.19**

**Tips:**
- Increase `usersPerContainer` to reduce container count
- Optimize tests to run faster
- Containers auto-shutdown when done

---

## 🐛 Troubleshooting

### Worker containers not starting
- ✅ Check Railway API token is valid
- ✅ Verify `RAILWAY_PROJECT_ID` and `RAILWAY_SERVICE_ID` are correct
- ✅ Check Railway dashboard for deployment errors

### Tests failing
- ✅ Test locally first: `cd worker && npx playwright test`
- ✅ Check test configuration in your test file's CONFIG object
- ✅ Verify your app can handle the load

### Logs not uploading
- ✅ Verify S3 credentials in Railway dashboard
- ✅ Check bucket exists (orchestrator creates it automatically)
- ✅ Review worker logs for upload errors

### Bucket not created
- ✅ Check storage credentials are correct
- ✅ Verify storage endpoint is accessible
- ✅ Check orchestrator logs for errors

### High costs
- ✅ Reduce `totalUsers` or increase `usersPerContainer`
- ✅ Optimize test speed
- ✅ Clean up failed containers manually

---

## 📝 Important Notes

### Worker Service
- ✅ Deployed **dynamically** by orchestrator (not always running)
- ✅ Each test run creates N new deployments
- ✅ Containers auto-shutdown after completion
- ⚠️ Failed containers require manual cleanup (no auto-cleanup yet)

### Orchestrator
- ❌ **NOT deployed to Railway** - runs on your local machine
- ✅ Uses Railway API to deploy worker containers
- ✅ Automatically creates S3 bucket if needed
- ✅ Requires Railway credentials in config file

### Storage
- ✅ Railway Buckets recommended (auto-configured)
- ✅ Any S3-compatible storage works
- ✅ Bucket created automatically on first run
- ✅ Results stored per run ID

### Test Configuration
- ✅ All test-specific config goes in test files
- ✅ Use the CONFIG object pattern (see `complete-example.spec.js`)
- ✅ No need to manage environment variables for test logic
- ✅ Tests are self-contained and portable

### Monorepo Structure
- ✅ Railway understands monorepo structure
- ✅ Worker service points to `worker/` root directory
- ✅ Orchestrator runs locally from `orchestrator/` directory

---

## 🔗 Quick Links

- **Railway Template:** https://railway.app/deploy/playwright-easyscale
- **Documentation:** [README.md](../README.md)
- **Setup Guide:** [SETUP.md](SETUP.md)
- **Example Config:** [configs/example.json](../configs/example.json)
- **Example Test:** [worker/tests/complete-example.spec.js](../worker/tests/complete-example.spec.js)

---

## ✅ Checklist

### Initial Setup
- [ ] Deploy Railway template
- [ ] Eject to your own repository
- [ ] Clone repository locally
- [ ] Install dependencies (`orchestrator/` and `worker/`)

### Per Test Run
- [ ] Copy `complete-example.spec.js` and customize CONFIG object
- [ ] Create config in `configs/` with test file name
- [ ] Test locally (optional): `npx playwright test tests/my-test.spec.js --headed`
- [ ] Dry run to verify distribution: `npm run dev`
- [ ] Deploy to Railway: `npm start`
- [ ] Monitor results in Railway dashboard and S3 bucket
- [ ] Clean up failed containers (if any)

---

**Made with ❤️ by CultureDrivers**
