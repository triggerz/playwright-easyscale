# Worker State Management Architecture

## Overview

This document describes the worker state management system used in playwright-easyscale. The architecture uses a **single source of truth** pattern where each worker's state is stored in one S3 file that both the orchestrator and worker read/write.

## State Machine

### Worker States

Workers can be in one of the following states:

- **`ready`** - Worker is deployed and waiting for start command
- **`testing`** - Worker is actively running tests
- **`finished`** - Worker completed all tests successfully
- **`stopped`** - Worker was stopped by admin before completion

### Commands

The orchestrator can send the following commands to workers:

- **`start`** - Begin test execution
- **`stop`** - Halt test execution immediately
- **`null`** - No command (default state)

## Storage Structure

Each worker has a single state file in S3:

```
runs/{runId}/workers/worker-{N}.json
```

This file contains:

```json
{
  "index": 1,
  "state": "ready|testing|finished|stopped",
  "command": null|"start"|"stop",
  "startUser": 1,
  "endUser": 10,
  "userCount": 10,
  "lastUpdated": "2026-05-13T14:00:00.000Z",
  "readyAt": "2026-05-13T14:00:00.000Z",
  "testingStartedAt": "2026-05-13T14:01:00.000Z",
  "finishedAt": "2026-05-13T14:05:00.000Z",
  "passed": 10,
  "failed": 0,
  "total": 10
}
```

## State Transitions

### 1. Deployment → Ready

**Trigger:** Worker container starts
**Process:**
1. `index.js` starts (centralized worker service)
2. Calls `updateState('ready')` with worker metadata
3. Waits for `command: 'start'`

### 2. Ready → Testing

**Trigger:** Admin clicks "Start Tests"
**Process:**
1. Orchestrator writes `command: 'start'` to all worker files
2. Worker detects command via `waitForCommand('start')`
3. Worker clears command with `clearCommand()`
4. Worker updates `state: 'testing'`
5. Worker spawns Playwright as child process
6. Worker begins monitoring for stop command in parallel

### 3. Testing → Finished

**Trigger:** All tests complete naturally
**Process:**
1. Playwright process exits with code 0
2. Worker stops command monitoring
3. Worker calls `uploadAllResults()` to upload logs/screenshots
4. Worker updates `state: 'finished'` with test results

### 4. Testing → Stopped

**Trigger:** Admin clicks "Stop Tests"
**Process:**
1. Orchestrator writes `command: 'stop'` to testing workers
2. Worker's command monitor detects stop command
3. Worker clears command with `clearCommand()`
4. Worker updates `state: 'stopped'`
5. Worker kills Playwright process tree (parent + all child workers)
6. Worker exits without uploading results

### 5. Stopped → Ready (Reset)

**Trigger:** Admin clicks "Reset"
**Process:**
1. Orchestrator updates stopped workers to `state: 'ready'`, `command: null`
2. Workers can now receive start command again

## Key Components

### Worker Side

#### `index.js` (Centralized Worker Service)
**Main entry point** that orchestrates the complete worker lifecycle:
1. Report ready state on startup
2. Wait for start command from orchestrator
3. Clear command and update to testing state
4. Spawn Playwright as child process using `child_process.spawn()`
5. Monitor for stop command in parallel (Promise.race pattern)
6. Wait for Playwright completion or stop signal
7. Upload results if tests completed naturally
8. Update final state (finished/stopped)
9. Handle graceful shutdown (SIGTERM/SIGINT)

**Key Features:**
- Single Node.js process manages everything
- Proper parent-child process relationship with Playwright
- Reliable process tree termination (kills all Playwright workers)
- No race conditions between separate scripts
- Clear async/await execution flow

#### `state-manager.js`
Central module for all state operations:
- `readState()` - Read current state from S3
- `updateState(state, data)` - Update worker state
- `waitForCommand(cmd)` - Block until specific command received
- `pollForCommand(callback)` - Continuously poll for commands
- `clearCommand()` - Clear command after processing

#### `upload-results.js`
Modular upload functionality (can be imported or run standalone):
- `uploadAllResults()` - Main function to upload logs, screenshots, and summary
- `parsePlaywrightResults()` - Parse test results from Playwright output
- Exports functions for use by `index.js`
- Can still be run standalone if needed

### Orchestrator Side

#### `runManager.js`

**`startRun(runId)`**
- Gets all workers
- Writes `command: 'start'` to each worker file
- Updates run status to 'running'

**`stopRun(runId)`**
- Gets all workers
- Writes `command: 'stop'` to workers in 'testing' state
- Updates run status to 'stopping'

**`resetRun(runId)`**
- Gets all workers
- Resets workers in 'stopped' state to 'ready'
- Clears commands
- Updates run status to 'ready'

## Why This Architecture?

### Previous Problems

The old architecture used two separate files:
- `runs/{runId}/control.json` - Orchestrator signals (start/stop)
- `runs/{runId}/workers/worker-{N}.json` - Worker status

This caused:
- Race conditions between files
- States getting overwritten
- Workers reverting to "ready" after stop
- Confusion about source of truth

### Current Solution

Single file per worker eliminates conflicts:
- Worker owns `state` field
- Orchestrator owns `command` field
- Worker polls its own file for commands
- No separate control file needed
- Clear ownership and responsibility

## UI Integration

The UI (`WorkerDashboard.jsx`) displays worker states:
- Shows current state with color coding
- Enables/disables buttons based on state
- Start button: enabled when all workers ready
- Stop button: enabled when any worker testing
- Reset button: enabled when any worker stopped
- Delete button: enabled when all workers finished or stopped

## Testing the Flow

1. Deploy workers → All show "ready"
2. Click "Start Tests" → All change to "testing"
3. Wait for completion → All change to "finished"
4. Click "Delete Workers" → Workers removed

OR:

1. Deploy workers → All show "ready"
2. Click "Start Tests" → All change to "testing"
3. Click "Stop Tests" → All change to "stopped"
4. Click "Reset" → All change back to "ready"
5. Repeat from step 2 or delete workers

## Worker Execution Model

### Previous Architecture (DEPRECATED)

The old approach used a shell script chain:
```bash
"start": "node startup.js && (node command-monitor.js & playwright test) && node upload-results.js"
```

**Problems:**
- Multiple separate Node processes couldn't coordinate
- Background process (`command-monitor.js &`) had no parent-child relationship with Playwright
- Shell didn't wait for all Playwright workers (5 parallel processes)
- `upload-results.js` executed too early or never executed
- No reliable way to kill all Playwright child processes
- Workers never reached "finished" state reliably

### Current Architecture

Single centralized service:
```bash
"start": "node index.js"
```

**Benefits:**
- ✅ Single Node.js process manages entire lifecycle
- ✅ Proper parent-child relationship with Playwright
- ✅ Reliable process tree termination
- ✅ Guaranteed state transitions
- ✅ No race conditions
- ✅ Clear async/await flow
- ✅ Better error handling
- ✅ Easier debugging

## Migration Notes

### Removed Files
- `worker/startup.js` - Logic moved to `index.js`
- `worker/command-monitor.js` - Logic moved to `index.js`
- `worker/stop-monitor.js` - Replaced by command monitoring in `index.js`
- `shared/storagePaths.js::getRunControlPath()` - No longer needed

### New Files
- `worker/index.js` - Centralized worker service (main entry point)
- `worker/state-manager.js` - State management module

### Modified Files
- `worker/upload-results.js` - Now exports functions for use as module
- `worker/package.json` - Changed to `"start": "node index.js"`
- `worker/Dockerfile` - Copies `index.js` instead of startup/command-monitor
- `orchestrator/src/services/runManager.js` - Writes commands not signals
- `web-ui/src/components/WorkerDashboard.jsx` - Shows new states
