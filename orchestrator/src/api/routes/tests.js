/**
 * Test routes - List and get test information
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const TestScanner = require('../../services/testScanner');

// Initialize test scanner
const testsDir = path.join(__dirname, '../../../..', 'worker', 'tests');
const scanner = new TestScanner(testsDir);

/**
 * GET /api/tests
 * List all available tests
 */
router.get('/', async (req, res) => {
  try {
    const tests = await scanner.scanTests();
    res.json({ tests });
  } catch (error) {
    console.error('Error listing tests:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/tests/:testFile/schema
 * Get parameter schema for a specific test
 */
router.get('/:testFile/schema', async (req, res) => {
  try {
    const { testFile } = req.params;
    const test = await scanner.getTestMetadata(testFile);
    
    if (!test) {
      return res.status(404).json({
        error: 'Not found',
        message: `Test file ${testFile} not found`
      });
    }

    res.json({
      file: test.file,
      metadata: test.metadata
    });
  } catch (error) {
    console.error('Error getting test schema:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
