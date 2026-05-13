#!/usr/bin/env node

/**
 * Post-test script to upload logs and results to storage
 * This runs after Playwright tests complete
 * 
 * Can be used as standalone script or imported as module
 */

const { uploadLogs, uploadScreenshots, uploadTestResults } = require('./helpers/logUpload');
const fs = require('fs');
const path = require('path');

/**
 * Upload all results (logs, screenshots, summary)
 * Can be called from index.js or run standalone
 */
async function uploadAllResults() {
  console.log('\n========================================');
  console.log('📤 UPLOAD-RESULTS.JS STARTED');
  console.log(`Worker ${process.env.SHARD_INDEX || '1'} - Run ${process.env.RUN_ID}`);
  console.log('========================================\n');

  // Get environment variables
  const runId = process.env.RUN_ID;
  const shardIndex = process.env.SHARD_INDEX || '1';
  const storageConfig = {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'auto'
  };

  // Validate configuration
  if (!runId) {
    console.error('❌ RUN_ID environment variable not set');
    process.exit(1);
  }

  if (!storageConfig.endpoint || !storageConfig.accessKey || !storageConfig.secretKey || !storageConfig.bucket) {
    console.error('❌ Storage configuration incomplete');
    console.error('   Required: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET');
    process.exit(1);
  }

  try {
    // Parse Playwright test results to get pass/fail counts
    const testStats = parsePlaywrightResults();
    
    // Upload Playwright test results
    const testResultsPath = path.join(__dirname, 'test-results');
    if (fs.existsSync(testResultsPath)) {
      console.log('📊 Uploading test results...');
      await uploadLogs(runId, shardIndex, testResultsPath, storageConfig);
    }

    // Upload screenshots
    const screenshotsPath = path.join(__dirname, 'test-results');
    if (fs.existsSync(screenshotsPath)) {
      console.log('📸 Uploading screenshots...');
      await uploadScreenshots(runId, shardIndex, screenshotsPath, storageConfig);
    }

    // Create and upload summary
    const summary = {
      runId,
      shardIndex,
      timestamp: new Date().toISOString(),
      userRangeStart: process.env.USER_RANGE_START,
      userRangeEnd: process.env.USER_RANGE_END,
      status: 'completed',
      ...testStats
    };

    console.log('📝 Uploading summary...');
    await uploadTestResults(runId, shardIndex, summary, storageConfig);

    console.log('\n✅ All results uploaded successfully!');
    console.log(`📊 Test Results: ${testStats.passed} passed, ${testStats.failed} failed, ${testStats.total} total`);
    
    // Check if we were stopped, otherwise mark as finished
    const { readState, updateState } = require('./state-manager');
    const currentState = await readState();
    
    let finalState;
    if (currentState && currentState.state === 'stopped') {
      // Already stopped, don't overwrite
      finalState = 'stopped';
      console.log(`\n✓ Worker already in 'stopped' state, preserving it`);
    } else {
      // Mark as finished
      finalState = 'finished';
      console.log(`\n🔄 Updating worker state to: ${finalState}`);
      await updateState(finalState, {
        ...testStats,
        finishedAt: new Date().toISOString()
      });
    }
    
    console.log('\n========================================');
    console.log('✅ UPLOAD-RESULTS.JS COMPLETED');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error(error.stack);
    
    // Update worker status to failed
    await updateWorkerStatus('failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Parse Playwright test results from JSON reporter output
 */
function parsePlaywrightResults() {
  console.log('\n========================================');
  console.log('🔍 DEBUG: parsePlaywrightResults() called');
  console.log('========================================');
  
  try {
    const resultsPath = path.join(__dirname, 'test-results', 'results.json');
    console.log(`📁 Checking for results file at: ${resultsPath}`);
    
    // Try to read Playwright's JSON results
    if (fs.existsSync(resultsPath)) {
      console.log('✅ Results file exists!');
      
      const fileContent = fs.readFileSync(resultsPath, 'utf8');
      console.log(`📄 File size: ${fileContent.length} bytes`);
      console.log(`📄 First 500 chars: ${fileContent.substring(0, 500)}`);
      
      const results = JSON.parse(fileContent);
      console.log('✅ JSON parsed successfully');
      console.log(`📊 Results structure keys: ${Object.keys(results).join(', ')}`);
      
      // Count test results from suites
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      
      if (results.suites) {
        console.log(`📦 Found ${results.suites.length} top-level suites`);
        
        const countTests = (suites, depth = 0) => {
          const indent = '  '.repeat(depth);
          for (const suite of suites) {
            console.log(`${indent}📂 Suite: ${suite.title || '(no title)'}`);
            
            if (suite.specs) {
              console.log(`${indent}  📝 Found ${suite.specs.length} specs`);
              for (const spec of suite.specs) {
                console.log(`${indent}    - ${spec.title}: ok=${spec.ok}`);
                if (spec.ok) {
                  passed++;
                } else {
                  failed++;
                }
              }
            }
            if (suite.suites) {
              console.log(`${indent}  📦 Has ${suite.suites.length} nested suites`);
              countTests(suite.suites, depth + 1);
            }
          }
        };
        countTests(results.suites);
      } else {
        console.log('⚠️  No suites found in results');
      }
      
      const total = passed + failed + skipped;
      
      console.log('\n📊 FINAL COUNTS:');
      console.log(`   Total: ${total}`);
      console.log(`   Passed: ${passed}`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Skipped: ${skipped}`);
      console.log('========================================\n');
      
      return {
        total,
        passed,
        failed,
        skipped
      };
    } else {
      console.log('❌ Results file does NOT exist');
      console.log('📁 Checking test-results directory...');
      
      // Fallback: count test result directories
      const testResultsPath = path.join(__dirname, 'test-results');
      if (fs.existsSync(testResultsPath)) {
        console.log('✅ test-results directory exists');
        const allItems = fs.readdirSync(testResultsPath);
        console.log(`📂 Items in test-results: ${allItems.join(', ')}`);
        
        const dirs = allItems.filter(f => {
          const fullPath = path.join(testResultsPath, f);
          return fs.statSync(fullPath).isDirectory();
        });
        
        console.log(`📁 Directories found: ${dirs.join(', ')}`);
        
        const failed = dirs.filter(d => d.includes('failed')).length;
        const total = dirs.length;
        
        console.log(`📊 Fallback counts: ${total} total, ${total - failed} passed, ${failed} failed`);
        
        return {
          total,
          passed: total - failed,
          failed,
          skipped: 0
        };
      } else {
        console.log('❌ test-results directory does NOT exist');
      }
    }
  } catch (error) {
    console.error('❌ ERROR in parsePlaywrightResults:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('⚠️  Returning zeros (no results found)');
  console.log('========================================\n');
  
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };
}


/**
 * Main function for standalone execution
 */
async function main() {
  await uploadAllResults();
}

// Export for use as module
module.exports = {
  uploadAllResults,
  parsePlaywrightResults
};

// Run as standalone script if executed directly
if (require.main === module) {
  main();
}
