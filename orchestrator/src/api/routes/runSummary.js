/**
 * Run Summary Route - Generate and log run completion summary
 */

const express = require('express');
const router = express.Router();
const RunManager = require('../../services/runManager');
const { createLogger, formatDuration, calculateSuccessRate } = require('@playwright-easyscale/shared/logger');

const runManager = new RunManager();

// Initialize run manager
runManager.initialize().catch(console.error);

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

module.exports = router;
