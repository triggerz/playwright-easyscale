# Web UI Setup Guide

This guide explains how to set up and use the Playwright EasyScale Web UI for managing distributed test runs.

## Architecture Overview

The system consists of three main components:

1. **Web UI** (React + Vite) - User interface for managing tests
2. **Orchestrator API** (Express.js) - Backend API for test management
3. **S3 Bucket** - All storage (parameters, runs, logs, results)
4. **Worker Containers** (Railway) - Execute Playwright tests

**No Redis/Valkey needed!** Everything is stored in S3, making the architecture simpler and more cost-effective.

### Storage Structure

The S3 bucket is organized as follows:
```
bucket/
├── runs/
│   ├── run-123.json                    # Run metadata
│   ├── run-123/
│   │   ├── parameters/
│   │   │   ├── user-1.json            # Parameters for each user
│   │   │   ├── user-2.json
│   │   │   └── ...
│   │   └── workers/
│   │       ├── worker-1.json          # Worker status updates
│   │       ├── worker-2.json
│   │       └── ...
│   └── run-456.json
├── logs/              # Test logs
│   ├── run-123/
│   │   ├── worker-1.log
│   │   └── worker-2.log
│   └── run-456/
└── results/           # Test results (screenshots, videos, traces)
    ├── run-123/
    │   ├── screenshots/
    │   ├── videos/
    │   └── traces/
    └── run-456/
```

Everything related to a test run is kept together in one organized structure!

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker (for running Redis locally)
- Railway account (for deployment)

### Step 1: Configure Environment Variables

Create `.env` file in the `orchestrator` directory:

```bash
cd orchestrator
cp ../.env.example .env
```

Edit `.env` with your values:

```env
AUTH_SECRET=my-secret-passphrase
RAILWAY_API_TOKEN=your-token
RAILWAY_PROJECT_ID=your-project-id
RAILWAY_SERVICE_ID=your-worker-service-id
S3_ENDPOINT=your-s3-endpoint
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket
S3_REGION=auto
PORT=3000
```

### Step 2: Start the Orchestrator API

```bash
cd orchestrator
npm install
npm run dev
```

The API will start on `http://localhost:3000`

### Step 3: Start the Web UI

```bash
cd web-ui
npm install
npm run dev
```

The Web UI will start on `http://localhost:5173`

### Step 4: Access the Web UI

1. Open `http://localhost:5173` in your browser
2. Enter the passphrase (value of `AUTH_SECRET` from your `.env`)
3. You're ready to run tests!

## Using the Web UI

### 1. Select a Test

- The UI will automatically scan the `worker/tests/` directory
- Tests with metadata will show their name and description
- Click on a test to select it

### 2. Configure Test Run

- **Total Users**: Number of concurrent users to simulate
- **Users per Container**: How many users each Railway container should handle
- **Test Parameters**: Dynamic form based on test metadata

### 3. Start Test Run

- Click "Start Test Run" to deploy containers to Railway
- The UI will switch to the "Running" view automatically

### 4. Monitor Progress

- **Stats Panel**: Overview of the run (users, containers, duration, cost)
- **Worker Dashboard**: Status of each container
- **Log Viewer**: Aggregated logs from all workers

## Writing Tests with Metadata

Tests can declare their required parameters using a special comment block:

```javascript
/**
 * @test-metadata
 * {
 *   "name": "Login Stress Test",
 *   "description": "Simulates concurrent user logins",
 *   "parameters": [
 *     {
 *       "key": "loginUrl",
 *       "label": "Login URL",
 *       "type": "url",
 *       "default": "https://example.com/login",
 *       "description": "The URL of the login page",
 *       "required": true
 *     },
 *     {
 *       "key": "credentials",
 *       "label": "User Credentials",
 *       "type": "array",
 *       "description": "Array of email/password pairs",
 *       "required": false
 *     }
 *   ]
 * }
 */

const { test } = require('@playwright/test');
const { loadParametersForUser } = require('../helpers/parameterLoader');

// Your test code here...
```

### Supported Parameter Types

- `string` - Text input
- `url` - URL input
- `number` - Number input
- `array` - JSON array (textarea with validation)

## Railway Deployment

### Deploy Orchestrator API

1. Create a new Railway service
2. Connect your GitHub repository
3. Set root directory to `orchestrator`
4. Add environment variables (same as local `.env`)
5. **No volume mounting needed** - everything is stored in S3
6. Deploy

### Deploy Web UI

1. Create a new Railway service
2. Connect your GitHub repository
3. Set root directory to `web-ui`
4. Add environment variable: `VITE_API_URL=https://your-orchestrator-url.railway.app`
5. Deploy

### Configure S3 Storage

1. Use Railway Buckets (recommended) or external S3-compatible storage
2. Add S3 credentials to orchestrator environment variables
3. Workers automatically use the same bucket for logs and results

## API Endpoints

### Authentication

```
POST /api/auth/login
Body: { "passphrase": "your-secret" }
Response: { "token": "your-token" }
```

### Tests

```
GET /api/tests
Response: { "tests": [...] }

GET /api/tests/:testFile/schema
Response: { "file": "...", "metadata": {...} }
```

### Runs

```
POST /api/runs
Body: {
  "testFile": "example.spec.js",
  "totalUsers": 100,
  "usersPerContainer": 10,
  "parameters": {...}
}

GET /api/runs
GET /api/runs/:runId
GET /api/runs/:runId/workers
GET /api/runs/:runId/logs
DELETE /api/runs/:runId
```

### Stats

```
GET /api/stats
Response: {
  "totalRuns": 10,
  "runningRuns": 2,
  "completedRuns": 7,
  "failedRuns": 1,
  ...
}
```

## Troubleshooting

### Authentication fails

- Verify `AUTH_SECRET` is set in orchestrator
- Ensure you're using the correct passphrase
- Check browser console for errors

### Tests not showing up

- Verify test files are in `worker/tests/` directory
- Check test files end with `.spec.js`
- Ensure metadata format is correct (valid JSON in comment)

### Workers not deploying

- Verify Railway credentials are correct
- Check Railway API token has proper permissions
- Ensure worker service exists in Railway project

## Security Notes

- The `AUTH_SECRET` is a simple passphrase - keep it secure
- Never commit `.env` files to version control
- Use Railway's environment variables for production secrets
- Consider adding rate limiting for production use

## Next Steps

- Add more test files with metadata
- Customize the Web UI styling
- Implement log aggregation from S3
- Add test result visualization
- Set up scheduled test runs
