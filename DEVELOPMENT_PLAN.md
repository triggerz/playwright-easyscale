# Development Plan: Playwright EasyScale

## Project Overview

Build a distributed browser testing framework that automatically scales Playwright tests across multiple Railway containers. This is an open-source infrastructure project - users bring their own tests.

## Timeline: 1 Week (AI-Assisted Development)

---

## Day 1: Worker Foundation

### Goals
- Create containerized test runner
- Set up basic Playwright configuration
- Test locally with Docker

### Tasks

#### 1.1 Worker Directory Structure
```
worker/
├── tests/
│   └── example.spec.js          # Simple example test
├── helpers/
│   └── utils.js                 # Shared utilities
├── Dockerfile                   # Container definition
├── playwright.config.js         # Playwright configuration
├── package.json                 # Dependencies
└── .dockerignore               # Docker ignore rules
```

#### 1.2 Create Dockerfile
- Base image: `mcr.microsoft.com/playwright:v1.40.0-focal`
- Install dependencies
- Copy test files
- Set entrypoint to run tests
- Accept environment variables

#### 1.3 Playwright Configuration
- Configure for headless mode
- Set timeouts
- Configure screenshot/video capture
- Set up test parallelization
- Environment variable support

#### 1.4 Example Test
Create `tests/example.spec.js`:
- Read `USER_RANGE_START` and `USER_RANGE_END` from env
- Generate test for each user in range
- Simple login flow example
- Demonstrate state management

#### 1.5 Local Testing
```bash
# Build Docker image
docker build -t playwright-worker ./worker

# Run with different user ranges
docker run -e USER_RANGE_START=1 -e USER_RANGE_END=5 playwright-worker
docker run -e USER_RANGE_START=6 -e USER_RANGE_END=10 playwright-worker
```

### Deliverables
- [ ] Working Dockerfile
- [ ] Example test that reads env vars
- [ ] Playwright config
- [ ] Local Docker test successful

---

## Day 2: Log Storage & Worker Polish

### Goals
- Implement S3/R2 log upload
- Add screenshot management
- Improve error handling
- Test with multiple containers

### Tasks

#### 2.1 Log Upload Module
Create `worker/helpers/logUpload.js`:
- S3/R2 client setup
- Upload logs after test completion
- Upload screenshots
- Structured log format (JSON)
- Error handling

#### 2.2 Enhanced Logging
- Session-specific log files
- Timestamp all entries
- Log test progress
- Capture errors with context
- Performance metrics

#### 2.3 Screenshot Management
- Capture on failure
- Capture at key checkpoints
- Organize by user/session
- Upload to S3 with metadata

#### 2.4 Worker Utilities
Create `worker/helpers/utils.js`:
- User email generation
- Sleep/delay functions
- State detection helpers
- Retry logic
- Environment variable parsing

#### 2.5 Multi-Container Test
```bash
# Simulate 3 containers running in parallel
docker run -e USER_RANGE_START=1 -e USER_RANGE_END=3 -e SHARD_INDEX=1 playwright-worker &
docker run -e USER_RANGE_START=4 -e USER_RANGE_END=6 -e SHARD_INDEX=2 playwright-worker &
docker run -e USER_RANGE_START=7 -e USER_RANGE_END=9 -e SHARD_INDEX=3 playwright-worker &
```

### Deliverables
- [ ] S3/R2 log upload working
- [ ] Screenshots uploaded
- [ ] Helper utilities
- [ ] Multi-container test successful

---

## Day 3: Orchestrator Core

### Goals
- Create CLI orchestrator
- Implement Railway API integration
- Calculate container distribution
- Deploy test containers

### Tasks

#### 3.1 Orchestrator Structure
```
orchestrator/
├── src/
│   ├── index.js              # CLI entry point
│   ├── railway.js            # Railway API client
│   ├── config.js             # Config loader/validator
│   ├── distributor.js        # User distribution logic
│   └── logger.js             # Orchestrator logging
├── package.json
└── README.md
```

#### 3.2 Configuration Loader
Create `orchestrator/src/config.js`:
- Load JSON config files
- Validate required fields
- Support environment variable substitution
- Provide defaults
- Schema validation

#### 3.3 Distribution Logic
Create `orchestrator/src/distributor.js`:
- Calculate containers needed
- Distribute users evenly
- Generate env vars for each container
- Handle remainder users
- Optimize for cost/performance

Example:
```javascript
// 100 users, 7 per container = 15 containers
// Container 1: users 1-7
// Container 2: users 8-14
// ...
// Container 15: users 99-100 (only 2 users)
```

#### 3.4 Railway API Client
Create `orchestrator/src/railway.js`:
- Authenticate with API token
- Deploy service with env vars
- Monitor deployment status
- Get deployment logs
- Delete deployments

#### 3.5 CLI Interface
Create `orchestrator/src/index.js`:
- Parse command-line arguments
- Load configuration
- Display test plan
- Confirm before deploying
- Execute deployment
- Show progress

### Deliverables
- [ ] Config loader with validation
- [ ] Distribution algorithm
- [ ] Railway API integration
- [ ] Basic CLI working

---

## Day 4: Orchestrator Features

### Goals
- Implement monitoring
- Add cleanup logic
- Error handling
- Progress tracking

### Tasks

#### 4.1 Deployment Monitoring
- Poll Railway API for status
- Track container states
- Detect failures
- Restart failed containers
- Timeout handling

#### 4.2 Progress Tracking
- Count active containers
- Estimate completion time
- Show real-time stats
- Display errors as they occur

#### 4.3 Cleanup Logic
- Wait for all containers to complete
- Collect final logs
- Delete Railway deployments
- Generate summary report
- Handle partial failures

#### 4.4 Error Handling
- Network failures
- API rate limits
- Container crashes
- Timeout scenarios
- Partial success handling

#### 4.5 CLI Improvements
- Colored output
- Progress indicators
- Confirmation prompts
- Verbose mode
- Dry-run mode

### Deliverables
- [ ] Monitoring system
- [ ] Cleanup automation
- [ ] Error handling
- [ ] Improved CLI UX

---

## Day 5: Integration & Testing

### Goals
- End-to-end testing
- Log aggregation
- Documentation
- Bug fixes

### Tasks

#### 5.1 End-to-End Test
- Create test config for 20 users
- Deploy to Railway
- Monitor execution
- Verify logs uploaded
- Check cleanup

#### 5.2 Log Aggregation
Create `orchestrator/src/logAggregator.js`:
- Download logs from S3
- Merge logs by timestamp
- Generate summary statistics
- Create HTML report
- Identify failures

#### 5.3 Summary Report
Generate after test completion:
- Total users simulated
- Success/failure rate
- Average execution time
- Errors encountered
- Cost breakdown
- Links to logs/screenshots

#### 5.4 Configuration Examples
Create `configs/`:
- `example.json` - Basic example
- `stress-test.json` - Large scale (200 users)
- `quick-test.json` - Small test (10 users)

#### 5.5 Bug Fixes
- Fix issues found during testing
- Improve error messages
- Add validation
- Performance optimization

### Deliverables
- [ ] Successful end-to-end test
- [ ] Log aggregation working
- [ ] Summary reports
- [ ] Example configs
- [ ] Bug fixes

---

## Day 6: Documentation

### Goals
- Complete documentation
- Setup guides
- API reference
- Examples

### Tasks

#### 6.1 Setup Documentation
Create `docs/SETUP.md`:
- Prerequisites
- Installation steps
- Railway account setup
- S3/R2 configuration
- First test run

#### 6.2 Writing Tests Guide
Create `docs/WRITING_TESTS.md`:
- Test structure
- Environment variables
- User distribution
- Best practices
- Common patterns
- Debugging tips

#### 6.3 Railway Setup Guide
Create `docs/RAILWAY_SETUP.md`:
- Create Railway project
- Get API token
- Configure service
- Set up volumes
- Cost optimization

#### 6.4 Configuration Reference
Create `docs/CONFIGURATION.md`:
- All config options
- Environment variables
- Examples
- Validation rules

#### 6.5 Troubleshooting Guide
Create `docs/TROUBLESHOOTING.md`:
- Common errors
- Solutions
- Debugging steps
- FAQ

### Deliverables
- [ ] Complete documentation
- [ ] Setup guides
- [ ] Examples
- [ ] Troubleshooting guide

---

## Day 7: Polish & Release Prep

### Goals
- Final testing
- Code cleanup
- Release preparation
- Open source setup

### Tasks

#### 7.1 Code Quality
- ESLint configuration
- Code formatting
- Remove debug code
- Add comments
- Type hints (JSDoc)

#### 7.2 Testing
- Test all example configs
- Test error scenarios
- Test with different scales
- Performance testing
- Cost validation

#### 7.3 Repository Setup
- `.gitignore`
- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- GitHub issue templates
- PR template

#### 7.4 CI/CD
Create `.github/workflows/`:
- `test.yml` - Run tests on PR
- `docker.yml` - Build Docker image
- `release.yml` - Publish releases

#### 7.5 Release Preparation
- Version 1.0.0
- Changelog
- Release notes
- Demo video/GIF
- Update README

### Deliverables
- [ ] Clean, documented code
- [ ] All tests passing
- [ ] Repository configured
- [ ] CI/CD setup
- [ ] Ready for release

---

## Technical Specifications

### Worker Container

**Base Image**: `mcr.microsoft.com/playwright:v1.40.0-focal`

**Environment Variables**:
- `USER_RANGE_START` - First user ID (required)
- `USER_RANGE_END` - Last user ID (required)
- `SHARD_INDEX` - Container index (optional)
- `SHARD_TOTAL` - Total containers (optional)
- `RUN_ID` - Unique test run ID (required)
- `LOG_BUCKET` - S3 bucket for logs (required)
- `AWS_ACCESS_KEY_ID` - S3 credentials (required)
- `AWS_SECRET_ACCESS_KEY` - S3 credentials (required)
- Custom test variables (passed through)

**Resource Requirements**:
- Memory: 2GB minimum
- CPU: 2 vCPU recommended
- Disk: 1GB for browser cache

### Orchestrator

**Dependencies**:
- `commander` - CLI framework
- `axios` - HTTP client for Railway API
- `@aws-sdk/client-s3` - S3 client
- `chalk` - Terminal colors
- `ora` - Spinners
- `cli-progress` - Progress bars

**Configuration Schema**:
```json
{
  "name": "string (required)",
  "totalUsers": "number (required)",
  "usersPerContainer": "number (required)",
  "testFile": "string (required)",
  "environment": "object (optional)",
  "railway": {
    "projectId": "string (required)",
    "serviceId": "string (required)",
    "apiToken": "string (required)"
  },
  "storage": {
    "type": "s3|r2 (required)",
    "bucket": "string (required)",
    "region": "string (required)",
    "accessKeyId": "string (optional)",
    "secretAccessKey": "string (optional)"
  },
  "options": {
    "headless": "boolean (default: true)",
    "timeout": "number (default: 300000)",
    "retries": "number (default: 0)",
    "maxConcurrency": "number (default: 5)"
  }
}
```

### Railway API Integration

**Endpoints Used**:
- `POST /projects/{projectId}/services/{serviceId}/deployments` - Create deployment
- `GET /deployments/{deploymentId}` - Get deployment status
- `DELETE /deployments/{deploymentId}` - Delete deployment
- `GET /deployments/{deploymentId}/logs` - Get logs

**Authentication**: Bearer token in `Authorization` header

### S3/R2 Storage Structure

```
{bucket}/
└── {runId}/
    ├── orchestrator.log
    ├── summary.json
    ├── container-1/
    │   ├── user-1.log
    │   ├── user-2.log
    │   └── screenshots/
    │       ├── user-1-login.png
    │       └── user-1-error.png
    ├── container-2/
    │   └── ...
    └── ...
```

---

## Success Criteria

### Functional Requirements
- ✅ Deploy N containers to Railway via API
- ✅ Distribute users evenly across containers
- ✅ Run Playwright tests in each container
- ✅ Upload logs to S3/R2
- ✅ Aggregate logs after completion
- ✅ Clean up containers automatically
- ✅ Generate summary report

### Non-Functional Requirements
- ✅ Cost: ~$0.20 per 200-user test
- ✅ Setup time: < 5 minutes
- ✅ Execution time: Scales linearly with containers
- ✅ Reliability: Handle container failures gracefully
- ✅ Usability: Simple JSON configuration
- ✅ Documentation: Complete guides for all features

### Open Source Requirements
- ✅ MIT License
- ✅ Clear documentation
- ✅ Example tests included
- ✅ Contributing guidelines
- ✅ Issue templates
- ✅ CI/CD setup

---

## Future Enhancements (Post-Launch)

### Phase 2 Features
- Real-time log streaming to orchestrator
- Web UI dashboard for monitoring
- Slack/Discord notifications
- Test result analytics and trends
- Cost tracking and budgets

### Phase 3 Features
- Support for other cloud providers (AWS Lambda, GCP Cloud Run)
- Kubernetes deployment option
- Advanced scheduling (cron-based tests)
- Multi-region distribution
- Load balancing strategies

### Phase 4 Features
- Visual regression testing
- Performance metrics collection
- Integration with CI/CD platforms
- Test recording and playback
- Collaborative test writing

---

## Risk Mitigation

### Technical Risks
- **Railway API changes**: Pin API version, monitor changelog
- **Container failures**: Implement retry logic, health checks
- **Cost overruns**: Set max container limits, budget alerts
- **Log storage costs**: Implement log retention policies

### Project Risks
- **Scope creep**: Stick to MVP, defer advanced features
- **Timeline slippage**: Daily progress checks, adjust scope
- **Integration issues**: Test early and often
- **Documentation gaps**: Write docs alongside code

---

## Getting Started (For AI Assistant)

When you pick up this project in a new context:

1. **Read this plan first** - Understand the architecture
2. **Check current progress** - See which day's tasks are complete
3. **Review existing code** - Understand what's already built
4. **Continue from checkpoint** - Pick up where previous session left off
5. **Update this plan** - Mark completed tasks, adjust timeline

### Quick Context Recovery
- Project goal: Distributed Playwright testing on Railway
- Key innovation: Automatic container distribution
- Target users: Teams needing large-scale browser testing
- Unique value: Cost-effective, simple, open-source

### Code Style Guidelines
- Use modern JavaScript (ES6+)
- Functional programming style preferred
- Comprehensive error handling
- Clear variable names
- JSDoc comments for functions
- No trailing commas
- Single quotes for strings
- Semicolons required

---

## Questions to Answer During Development

- [ ] What's the optimal default for `usersPerContainer`?
- [ ] Should we support multiple test files in one run?
- [ ] How to handle test dependencies between users?
- [ ] Should orchestrator run in Railway or locally?
- [ ] What's the best way to handle secrets in config?
- [ ] Should we support test data generation?
- [ ] How to handle time zone differences in logs?
- [ ] Should we implement test result caching?

---

## Metrics to Track

### Development Metrics
- Lines of code
- Test coverage
- Documentation completeness
- Open issues

### Performance Metrics
- Container startup time
- Test execution time
- Log upload time
- Total cost per test

### User Metrics (Post-Launch)
- GitHub stars
- Downloads
- Issues opened
- PRs submitted
- Community engagement

---

## Contact & Support

For questions during development:
- Review existing code in `/worker` and `/orchestrator`
- Check Railway API docs: https://docs.railway.app/reference/public-api
- Check Playwright docs: https://playwright.dev/docs/intro
- Review S3 SDK docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/

---

**Last Updated**: 2026-05-08
**Status**: Ready to begin Day 1
**Next Action**: Create worker directory structure
