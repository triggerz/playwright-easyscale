# Playwright EasyScale

> **🎯 Template Repository**: Fork this repo to create your own distributed Playwright testing infrastructure!

A distributed browser testing framework for running large-scale Playwright tests across multiple Railway containers. This is a **template repository** - fork it and add your own tests!

## 🚀 Quick Start

### 1. Deploy Railway Template

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/deploy/playwright-easyscale)

Click the button above to deploy the complete infrastructure to Railway. This will:
- Set up the worker service with all environment variables
- Configure S3-compatible storage (Railway Buckets recommended)
- Create the orchestrator service
- Connect everything automatically

### 2. Eject to Your Own Repository

After deploying the template, you need to create your own fork:

1. Go to your Railway project dashboard
2. Click on any service (e.g., worker)
3. Go to the **Settings** tab
4. Find **Source Repo** section
5. Click **"Eject"** button

Railway will automatically:
- Create a fork of the repository in your GitHub account
- Connect the fork to your Railway project
- Handle the monorepo structure for all services

### 3. Clone Your Forked Repository

Now clone your own repository:

```bash
git clone https://github.com/YOUR_USERNAME/playwright-easyscale.git
cd playwright-easyscale

# Install orchestrator dependencies locally
cd orchestrator && npm install
```

### 4. Add Your Tests

Create your Playwright tests in `worker/tests/`:

```javascript
// worker/tests/my-test.spec.js
const { test, expect } = require('@playwright/test');

const userRangeStart = parseInt(process.env.USER_RANGE_START || '1');
const userRangeEnd = parseInt(process.env.USER_RANGE_END || '1');

for (let userId = userRangeStart; userId <= userRangeEnd; userId++) {
  test(`User ${userId} workflow`, async ({ page }) => {
    // Your test logic here
  });
}
```

### 5. Run Your Tests

```bash
# Test locally (dry run)
cd orchestrator
node src/index.js --config=../configs/example.json --dry-run

# Deploy to Railway
node src/index.js --config=../configs/example.json
```

All Railway credentials and storage configuration are already set up via the template!

## 📖 Overview

**Break free from single-machine hardware limits!** 

This project solves the fundamental problem of running large-scale browser tests: **your local machine can't handle hundreds of concurrent browser instances**. Traditional approaches like Puppeteer clusters quickly hit CPU, memory, and network bottlenecks on a single machine.

Playwright EasyScale distributes your tests across multiple Railway containers, giving you:
- **Unlimited horizontal scaling** - Add more containers, not more RAM
- **Unlimited vertical scaling** - Each container gets dedicated resources
- **No hardware constraints** - Break through the limits of a single machine

### Perfect For

- 🧪 **Stress Testing** - Simulate hundreds or thousands of concurrent users
- 📊 **Load Testing** - Test application performance under realistic load
- 🔄 **Large Test Suites** - Run massive regression suites in parallel
- 👥 **Multi-User Scenarios** - Test complex user interactions at scale

### Why This Exists

**The Problem**: Running 100+ concurrent browser instances on one machine causes:
- Memory exhaustion
- CPU throttling
- Network saturation
- Flaky tests due to resource contention

**The Solution**: Distribute tests across cloud containers where each gets dedicated resources. Scale horizontally by adding more containers, not by buying bigger machines.

### Key Features

- 🚀 **Automatic Distribution** - Splits tests across N containers automatically
- 💰 **Cost Effective** - Pay only for test duration (~$0.20 per 200-user test)
- 📊 **Centralized Logging** - Aggregates logs from all containers to S3-compatible storage
- 🔧 **Simple Configuration** - JSON-based test configuration
- ⚡ **Railway Template** - One-click deployment, no infrastructure setup
- ♻️ **Template Repository** - Fork and customize for your needs

## 🏗️ Architecture

```
playwright-easyscale/
├── orchestrator/          # Coordinator service (runs locally)
│   ├── src/
│   │   ├── index.js      # Main CLI
│   │   ├── config.js     # Configuration loader
│   │   ├── distributor.js # User distribution logic
│   │   ├── railway.js    # Railway API client
│   │   └── logger.js     # Logging utilities
│   └── package.json
│
├── worker/               # Test runner container (runs on Railway)
│   ├── tests/           # 👈 Add your tests here!
│   │   └── example.spec.js
│   ├── helpers/
│   │   ├── utils.js
│   │   └── logUpload.js
│   ├── index.js         # Centralized worker service (main entry point)
│   ├── state-manager.js # Worker state management
│   ├── upload-results.js # Result upload handler (modular)
│   ├── Dockerfile
│   ├── playwright.config.js
│   └── package.json
│
├── test-app/             # Demo app for example tests (optional)
│   ├── index.html       # Simple login/dashboard app
│   ├── Dockerfile       # For Railway deployment
│   └── README.md        # Deployment instructions
│
├── configs/              # Test configurations
│   └── example.json     # 👈 Copy and customize this!
│
└── docs/                 # Documentation
    └── SETUP.md
```

## 🎯 How It Works

### 1. Orchestrator (Local)

The orchestrator runs on your machine and:
- Reads test configuration
- Calculates optimal container distribution
- Deploys worker containers to Railway via API
- Passes unique environment variables to each container
- Monitors deployment status
- Aggregates results from storage

### 2. Worker Containers (Railway)

Each worker container runs a **centralized service** (`index.js`) that:
- Reports "ready" state when deployed
- Waits for "start" command from orchestrator
- Spawns Playwright as a child process
- Runs a subset of users (e.g., users 1-5, 6-10, etc.)
- Executes Playwright tests in parallel (5 workers per container)
- Monitors for "stop" command during execution
- Kills Playwright process tree when stopped
- Uploads logs and screenshots to S3-compatible storage
- Reports "finished" or "stopped" state when complete

**Key Architecture**: Single Node.js process manages the entire worker lifecycle, ensuring reliable state transitions and proper process management.

### 3. Distribution Example

**Configuration**: 100 users, 5 users per container

```
Container 1: Users 1-5    (5 users)
Container 2: Users 6-10   (5 users)
Container 3: Users 11-15  (5 users)
...
Container 20: Users 96-100 (5 users)
```

Each container receives:
- `USER_RANGE_START` and `USER_RANGE_END`
- `SHARD_INDEX` and `SHARD_TOTAL`
- Custom environment variables from config

## 📝 Configuration

Create a config file in `configs/`:

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

## 🛠️ Writing Tests Locally

**Important**: You don't need to replicate the full cloud infrastructure locally. The point of this project is to leverage cloud resources to overcome hardware limits. Local development is only for writing and testing individual test logic.

### Prerequisites

- **Node.js 18+** (for running orchestrator and Playwright)

### Workflow

1. **Write your tests** in `worker/tests/`:
   ```bash
   cd worker
   npm install
   
   # Run a single test locally to verify logic
   npx playwright test tests/my-test.spec.js --headed
   ```

2. **Test the orchestrator** (dry run to verify configuration):
   ```bash
   cd orchestrator
   npm install
   
   # Verify your config and distribution plan
   node src/index.js --config=../configs/my-test.json --dry-run
   ```

3. **Deploy to Railway** for actual scale testing:
   ```bash
   # This deploys N containers to Railway
   node src/index.js --config=../configs/my-test.json
   ```

**Why not test locally at scale?** Because that defeats the purpose! Running 100 browser instances locally will hit the exact hardware limits this project solves. Write tests locally, deploy to Railway for scale.

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Complete setup instructions
- **[Architecture](ARCHITECTURE.md)** - Worker state management architecture
- **[Web UI Setup](docs/WEB_UI_SETUP.md)** - Web dashboard setup
- **[Contributing](CONTRIBUTING.md)** - How to contribute
- **[License](LICENSE)** - MIT License

## 🚦 Current Status

**✅ Ready for Testing**

This is a functional template repository with:
- ✅ Working orchestrator with Railway API integration
- ✅ Worker container with Playwright and log upload
- ✅ Example tests and configuration
- ✅ Documentation and setup guides

**✅ Recently Added**:
- Web UI dashboard for managing test runs
- Worker state management (ready/testing/finished/stopped)
- Start/Stop/Reset controls for test runs
- Real-time worker status monitoring

**⚠️ Not Yet Implemented**:
- Real-time log streaming in UI
- Advanced error recovery
- Automatic retry logic

## 🎓 Example Usage

### Test Locally (Dry Run)

```bash
cd orchestrator
node src/index.js --config=../configs/example.json --dry-run
```

Output:
```
🚀 Playwright EasyScale Orchestrator

✔ Configuration loaded and validated

📊 Distribution Plan:
   Test: Example Stress Test
   Total Users: 20
   Users per Container: 5
   Total Containers: 4

   Container Breakdown:
   Container 1: Users 1-5 (5 users)
   Container 2: Users 6-10 (5 users)
   Container 3: Users 11-15 (5 users)
   Container 4: Users 16-20 (5 users)

✓ Dry run complete - no containers deployed
```

### Deploy to Railway

```bash
node src/index.js --config=../configs/example.json
```

## 🧪 Test User Credentials

For testing purposes, here are 10 test user credentials in JSON format:

```json
[
  {"email": "user1@example.com", "password": "TestPass123!"},
  {"email": "user2@example.com", "password": "TestPass123!"},
  {"email": "user3@example.com", "password": "TestPass123!"},
  {"email": "user4@example.com", "password": "TestPass123!"},
  {"email": "user5@example.com", "password": "TestPass123!"},
  {"email": "user6@example.com", "password": "TestPass123!"},
  {"email": "user7@example.com", "password": "TestPass123!"},
  {"email": "user8@example.com", "password": "TestPass123!"},
  {"email": "user9@example.com", "password": "TestPass123!"},
  {"email": "user10@example.com", "password": "TestPass123!"}
]
```

**Usage**: Copy this JSON array and paste it into the test parameters field when creating a run in the web UI.

## 🤝 Contributing

This is a template repository - feel free to:
- Fork it and customize for your needs
- Submit PRs with improvements
- Report issues or request features
- Share your use cases

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [Playwright](https://playwright.dev/) - Browser automation
- [Railway](https://railway.app/) - Container hosting
- [AWS S3 SDK](https://aws.amazon.com/sdk-for-javascript/) - Storage integration

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/triggerz/playwright-easyscale/issues)
- 💬 [Discussions](https://github.com/triggerz/playwright-easyscale/discussions)

---

**Made with ❤️ by CultureDrivers**

*Fork this repo and start scaling your Playwright tests today!* 🚀
