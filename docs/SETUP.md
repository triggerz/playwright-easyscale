# Setup Guide

## 🚀 Quick Setup (Recommended)

### Deploy the Railway Template

The easiest way to get started is to deploy the Railway template:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/deploy/playwright-easyscale)

This automatically sets up:
- ✅ Worker service (Playwright test runner)
- ✅ S3-compatible storage (Railway Buckets recommended)
- ✅ All environment variables
- ✅ Cross-service connections

**That's it!** Your infrastructure is ready. No manual configuration needed.

---

## 📝 Eject and Clone Your Repository

After deploying the template, you need to create your own fork:

### Step 1: Eject from Template

1. Go to your Railway project dashboard
2. Click on any service (e.g., worker)
3. Go to the **Settings** tab
4. Find **Source Repo** section
5. Click **"Eject"** button

**What happens**: Railway automatically creates a fork in your GitHub account and connects it to your project. It handles the monorepo structure for all services.

**Note**: You only need to click "Eject" once - Railway understands it's a monorepo and will handle all services.

### Step 2: Clone Your Fork

Now clone your own repository:

```bash
# Clone your forked repository
git clone https://github.com/YOUR_USERNAME/playwright-easyscale.git
cd playwright-easyscale

# Install worker dependencies
cd worker
npm install
```

---

## ✍️ Writing Your Tests

### Create Your Test Files

Add your Playwright tests to `worker/tests/`:

```javascript
// worker/tests/my-test.spec.js
const { test, expect } = require('@playwright/test');

const userRangeStart = parseInt(process.env.USER_RANGE_START || '1');
const userRangeEnd = parseInt(process.env.USER_RANGE_END || '1');

for (let userId = userRangeStart; userId <= userRangeEnd; userId++) {
  test(`User ${userId} workflow`, async ({ page }) => {
    const email = `user${userId}@example.com`;
    
    // Your test logic here
    await page.goto(process.env.LOGIN_URL);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', process.env.PASSWORD);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/dashboard/);
  });
}
```

### Test Locally (Single Test)

Run a single test locally to verify your test logic:

```bash
cd worker

# Run one test in headed mode to see what's happening
npx playwright test tests/my-test.spec.js --headed

# Or run headless
npx playwright test tests/my-test.spec.js
```

**Important**: Only test individual test logic locally. Don't try to run 100 browser instances on your local machine - that's what Railway is for!

---

## ⚙️ Configuration

### Create a Test Configuration

Copy the example config and customize it:

```bash
cp configs/example.json configs/my-test.json
```

Edit `configs/my-test.json`:

```json
{
  "name": "My Stress Test",
  "totalUsers": 100,
  "usersPerContainer": 5,
  "testFile": "my-test.spec.js",
  "environment": {
    "LOGIN_URL": "https://your-app.com",
    "PASSWORD": "test-password"
  },
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
  },
  "options": {
    "headless": true,
    "timeout": 300000,
    "retries": 0,
    "maxConcurrency": 5
  }
}
```

**Note**: All the Railway and storage variables are automatically set by the Railway template. You just need to customize the test-specific settings like `LOGIN_URL`.

---

## 🚀 Running Tests at Scale

### Install Orchestrator

```bash
cd orchestrator
npm install
```

### Dry Run (Verify Configuration)

Test your configuration without deploying:

```bash
node src/index.js --config=../configs/my-test.json --dry-run
```

This shows you:
- How many containers will be deployed
- How users will be distributed
- Estimated cost

### Deploy to Railway

When you're ready, deploy to Railway:

```bash
node src/index.js --config=../configs/my-test.json
```

The orchestrator will:
1. Calculate the distribution (e.g., 100 users ÷ 5 = 20 containers)
2. Deploy 20 containers to Railway
3. Each container reports "ready" state
4. Use the Web UI to start tests (or use API)
5. Workers execute tests for their user range
6. Results are uploaded to storage
7. Workers report "finished" or "stopped" state

**Note**: Workers wait for a "start" command before running tests. Use the Web UI dashboard to control test execution.

---

## 📊 Monitoring Results

### Web UI Dashboard

Access the Web UI to:
- View worker status in real-time (ready/testing/finished/stopped)
- Start/Stop/Reset test runs
- Monitor test progress
- Delete workers when complete

See [WEB_UI_SETUP.md](WEB_UI_SETUP.md) for setup instructions.

### View Logs

- **Web UI**: Real-time worker status monitoring
- **Railway Dashboard**: View container logs in real-time
- **Orchestrator Logs**: Check `orchestrator/logs/orchestrator-{runId}.log`
- **Storage**: Download results from your S3-compatible storage bucket

### Results Structure

Results are stored in your bucket under:
```
{runId}/
├── container-1/
│   ├── results.json
│   └── screenshots/
├── container-2/
│   ├── results.json
│   └── screenshots/
└── ...
```

---

## 🎯 Why Not Test Locally at Scale?

**You might be tempted to run 100 browser instances locally to test before deploying.**

**Don't do this!** Here's why:

### The Problem This Project Solves

Running many concurrent browser instances on a single machine causes:
- **Memory exhaustion** - Each browser needs 100-500MB
- **CPU throttling** - Browsers are CPU-intensive
- **Network saturation** - All traffic through one connection
- **Flaky tests** - Resource contention causes random failures

### The Solution

This project distributes tests across cloud containers where:
- Each container gets dedicated resources
- You can scale horizontally (add more containers)
- You can scale vertically (bigger containers)
- No single-machine bottlenecks

### Local Development Workflow

1. **Write tests locally** - Test individual test logic with 1-2 browser instances
2. **Verify with dry-run** - Check configuration and distribution plan
3. **Deploy to Railway** - Run at scale with N containers

**Local = Test logic | Railway = Test scale**

---

## 🛠️ Advanced Configuration

### Adjusting Container Distribution

```json
{
  "totalUsers": 100,
  "usersPerContainer": 5  // 20 containers
}
```

**More users per container** = Fewer containers, lower cost, but each container needs more resources

**Fewer users per container** = More containers, higher cost, but better isolation

### Recommended Settings

- **Small tests (10-50 users)**: 5 users per container
- **Medium tests (50-200 users)**: 5-10 users per container
- **Large tests (200+ users)**: 10-20 users per container

### Test Options

```json
{
  "options": {
    "headless": true,           // Run browsers in headless mode
    "timeout": 300000,          // Test timeout (5 minutes)
    "retries": 0,               // Number of retries for failed tests
    "maxConcurrency": 5         // Max parallel tests per container
  }
}
```

---

## 🐛 Troubleshooting

### Tests Fail Locally But Work on Railway

This is normal! Your local machine may not have enough resources. The whole point is to run at scale on Railway.

### Containers Timeout

- Increase `timeout` in config
- Reduce `usersPerContainer` to lower load per container
- Check your application can handle the load

### Logs Not Uploading

- Verify storage credentials in Railway dashboard
- Check bucket exists and is accessible
- Review worker logs for upload errors

### High Costs

- Reduce `totalUsers` or increase `usersPerContainer`
- Containers are billed per second, so faster tests = lower cost
- Check Railway dashboard for actual usage

---

## 💡 Best Practices

### Test Development

1. Write tests with 1-2 users locally
2. Verify test logic works
3. Deploy with 10-20 users to Railway
4. Scale up gradually

### Configuration

1. Start with small tests (10-20 users)
2. Monitor results and adjust
3. Scale up as needed
4. Use dry-run to verify changes

### Cost Optimization

1. Run tests during development hours only
2. Use `usersPerContainer` to balance cost vs isolation
3. Set reasonable timeouts
4. Clean up failed containers manually (for now)

---

## 📚 Next Steps

- Read the [README](../README.md) for architecture overview
- Check [ARCHITECTURE.md](../ARCHITECTURE.md) for worker state management details
- See [WEB_UI_SETUP.md](WEB_UI_SETUP.md) for dashboard setup
- Check [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
- Join [Discussions](https://github.com/triggerz/playwright-easyscale/discussions) for help

---

## 🎓 Example Workflow

```bash
# 1. Deploy Railway template (one-time setup)
# Click the "Deploy on Railway" button

# 2. Clone your repository
git clone https://github.com/YOUR_USERNAME/playwright-easyscale.git
cd playwright-easyscale

# 3. Write your tests
cd worker
npm install
npx playwright test tests/my-test.spec.js --headed

# 4. Create configuration
cp configs/example.json configs/my-test.json
# Edit my-test.json with your settings

# 5. Test configuration
cd ../orchestrator
npm install
node src/index.js --config=../configs/my-test.json --dry-run

# 6. Deploy to Railway
node src/index.js --config=../configs/my-test.json

# 7. Monitor results in Railway dashboard and storage bucket
```

---

**Remember**: The goal is to break free from local hardware limits. Write tests locally, run them at scale on Railway! 🚀
