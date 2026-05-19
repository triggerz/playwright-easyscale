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
 * GET /api/runs/:runId/results
 * Get test results for a run from S3 storage
 */
router.get('/:runId/results', async (req, res) => {
  try {
    const { runId } = req.params;
    const results = await runManager.getRunResults(runId);
    
    res.json({ results });
  } catch (error) {
    console.error('Error getting results:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/runs/:runId/screenshots
 * Get screenshots for a run from S3 storage
 */
router.get('/:runId/screenshots', async (req, res) => {
  try {
    const { runId } = req.params;
    const screenshots = await runManager.getRunScreenshots(runId);
    
    res.json({ screenshots });
  } catch (error) {
    console.error('Error getting screenshots:', error);
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
 * DELETE /api/runs/:runId/data
 * Delete all test data (screenshots, results, logs) for a run from S3
 */
router.delete('/:runId/data', async (req, res) => {
  try {
    const { runId } = req.params;
    
    const result = await runManager.deleteRunData(runId);
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting run data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/runs/bulk-delete
 * Delete test data for multiple runs
 */
router.post('/bulk-delete', async (req, res) => {
  console.log('🗑️ Bulk delete request received');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { runIds } = req.body;
    
    if (!Array.isArray(runIds) || runIds.length === 0) {
      console.log('❌ Invalid runIds:', runIds);
      return res.status(400).json({
        error: 'Bad request',
        message: 'runIds must be a non-empty array'
      });
    }
    
    console.log(`📋 Processing bulk delete for ${runIds.length} runs...`);
    const results = await runManager.bulkDeleteRunData(runIds);
    
    const totalDeleted = results.reduce((sum, r) => sum + (r.deletedCount || 0), 0);
    const successCount = results.filter(r => !r.error).length;
    const failureCount = results.filter(r => r.error).length;
    
    console.log(`✅ Bulk delete completed: ${successCount} succeeded, ${failureCount} failed, ${totalDeleted} total objects deleted`);
    
    res.json({
      success: true,
      totalDeleted,
      successCount,
      failureCount,
      results
    });
  } catch (error) {
    console.error('Error bulk deleting run data:', error);
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
 * POST /api/runs/:runId/stop
 * Send stop signal to all workers (doesn't delete them)
 */
router.post('/:runId/stop', async (req, res) => {
  try {
    const { runId } = req.params;
    
    await runManager.stopRun(runId);
    
    res.json({ 
      message: `Stop signal sent to run ${runId}`,
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

/**
 * POST /api/runs/:runId/reset
 * Reset run and workers to ready state (clears stop signal)
 */
router.post('/:runId/reset', async (req, res) => {
  try {
    const { runId } = req.params;
    
    await runManager.resetRun(runId);
    
    res.json({ 
      message: `Run ${runId} reset to ready state`,
      runId 
    });
  } catch (error) {
    console.error('Error resetting run:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/runs/:runId/summary
 * Generate and log run completion summary
 */
router.post('/:runId/summary', async (req, res) => {
  try {
    const { runId } = req.params;
    
    // Get run metadata
    const run = await runManager.getRun(runId);
    if (!run) {
      return res.status(404).json({
        error: 'Not found',
        message: `Run ${runId} not found`
      });
    }
    
    // Get all workers
    const workers = await runManager.getWorkers(runId);
    
    // Get all results
    const results = await runManager.getRunResults(runId);
    
    // Calculate statistics
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;
    let workersCompleted = 0;
    let workersFailed = 0;
    
    for (const result of results) {
      totalPassed += result.passed || 0;
      totalFailed += result.failed || 0;
      totalTests += result.total || 0;
      
      if (result.status === 'completed') {
        workersCompleted++;
      } else if (result.status === 'failed') {
        workersFailed++;
      }
    }
    
    // Calculate duration
    const startTime = new Date(run.startedAt).getTime();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Prepare summary stats
    const stats = {
      passed: totalPassed,
      failed: totalFailed,
      total: totalTests,
      duration,
      workersCompleted,
      workersFailed,
      totalWorkers: workers.length
    };
    
    // Log completion summary to both console and S3
    const { createLogger, formatDuration, calculateSuccessRate } = require('@playwright-easyscale/shared/logger');
    const storageConfig = {
      endpoint: process.env.S3_ENDPOINT,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION || 'auto'
    };
    
    const logger = createLogger(storageConfig, runId, { source: 'orchestrator' });
    const successRate = calculateSuccessRate(stats.passed, stats.total);
    const durationFormatted = stats.duration ? formatDuration(stats.duration) : 'N/A';
    
    await logger.success('✅ RUN COMPLETED', {
      event: 'run_completed',
      totalTime: durationFormatted,
      passed: stats.passed,
      failed: stats.failed,
      total: stats.total,
      successRate: `${successRate}%`,
      workersCompleted: stats.workersCompleted || 0,
      workersFailed: stats.workersFailed || 0
    });
    
    res.json({
      message: 'Run summary logged successfully',
      runId,
      stats
    });
  } catch (error) {
    console.error('Error generating run summary:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/runs/:runId
 * Delete run metadata (deprecated - use DELETE /api/runs/:runId/workers instead)
 */
router.delete('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    
    res.json({ 
      message: `Use DELETE /api/runs/${runId}/workers to delete worker services`,
      runId 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
