/**
 * Run routes - Create and manage test runs
 */

const express = require('express');
const router = express.Router();
const RunManager = require('../../services/runManager');

const runManager = new RunManager();

// Initialize run manager
runManager.initialize().catch(console.error);

/**
 * POST /api/runs
 * Create and start a new test run
 */
router.post('/', async (req, res) => {
  try {
    const { testFile, totalUsers, usersPerContainer, parameters } = req.body;

    // Validation
    if (!testFile || !totalUsers || !usersPerContainer) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'testFile, totalUsers, and usersPerContainer are required'
      });
    }

    // Create run
    const run = await runManager.createRun({
      testFile,
      totalUsers,
      usersPerContainer,
      parameters: parameters || {}
    });

    // Deploy containers (async, don't wait)
    const railwayConfig = {
      apiToken: process.env.RAILWAY_API_TOKEN,
      projectId: process.env.RAILWAY_PROJECT_ID,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
      storage: {
        endpoint: process.env.S3_ENDPOINT,
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION || 'auto'
      }
    };

    // Start deployment in background
    runManager.deployRun(run.runId, railwayConfig)
      .then(() => console.log(`✓ Run ${run.runId} deployed successfully`))
      .catch(err => console.error(`✗ Run ${run.runId} deployment failed:`, err));

    res.json(run);
  } catch (error) {
    console.error('Error creating run:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/runs
 * List all runs
 */
router.get('/', async (req, res) => {
  try {
    const runs = await runManager.getAllRuns();
    res.json({ runs });
  } catch (error) {
    console.error('Error listing runs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/runs/:runId
 * Get run details
 */
router.get('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = await runManager.getRun(runId);
    
    if (!run) {
      return res.status(404).json({
        error: 'Not found',
        message: `Run ${runId} not found`
      });
    }

    res.json(run);
  } catch (error) {
    console.error('Error getting run:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/runs/:runId/workers
 * Get worker statuses for a run
 */
router.get('/:runId/workers', async (req, res) => {
  try {
    const { runId } = req.params;
    const workers = await runManager.getWorkers(runId);
    
    res.json({ workers });
  } catch (error) {
    console.error('Error getting workers:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/runs/:runId/logs
 * Get logs for a run from S3 storage
 */
router.get('/:runId/logs', async (req, res) => {
  try {
    const { runId } = req.params;
    const logs = await runManager.getRunLogs(runId);
    
    res.json({ logs });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/runs/:runId/start
 * Send start signal to all workers
 */
router.post('/:runId/start', async (req, res) => {
  try {
    const { runId } = req.params;
    
    await runManager.startRun(runId);
    
    res.json({ 
      message: `Start signal sent to run ${runId}`,
      runId 
    });
  } catch (error) {
    console.error('Error starting run:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/runs/:runId/workers
 * Delete all worker services for a run
 */
router.delete('/:runId/workers', async (req, res) => {
  try {
    const { runId } = req.params;
    
    // Build Railway config for cleanup
    const railwayConfig = {
      apiToken: process.env.RAILWAY_API_TOKEN,
      projectId: process.env.RAILWAY_PROJECT_ID,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID
    };
    
    await runManager.cleanupWorkers(runId, railwayConfig);
    
    res.json({ 
      message: `Workers for run ${runId} deleted`,
      runId 
    });
  } catch (error) {
    console.error('Error deleting workers:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/runs/:runId
 * Stop a run and clean up spawned services
 */
router.delete('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    
    // Build Railway config for cleanup
    const railwayConfig = {
      apiToken: process.env.RAILWAY_API_TOKEN,
      projectId: process.env.RAILWAY_PROJECT_ID,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID
    };
    
    await runManager.stopRun(runId, railwayConfig);
    
    res.json({ 
      message: `Run ${runId} stopped and services cleaned up`,
      runId 
    });
  } catch (error) {
    console.error('Error stopping run:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
