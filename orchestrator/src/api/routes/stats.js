/**
 * Stats routes - Overall statistics
 */

const express = require('express');
const router = express.Router();
const RunManager = require('../../services/runManager');

const runManager = new RunManager();

/**
 * GET /api/stats
 * Get overall statistics
 */
router.get('/', async (req, res) => {
  try {
    const runs = await runManager.getAllRuns();
    
    const stats = {
      totalRuns: runs.length,
      runningRuns: runs.filter(r => r.status === 'running').length,
      completedRuns: runs.filter(r => r.status === 'completed').length,
      failedRuns: runs.filter(r => r.status === 'failed').length,
      totalContainersDeployed: runs.reduce((sum, r) => sum + (r.totalContainers || 0), 0),
      totalUsersSimulated: runs.reduce((sum, r) => sum + (r.totalUsers || 0), 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
