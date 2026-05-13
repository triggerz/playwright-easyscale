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
1. `startup.js` runs
2. Calls `updateState('ready')` with worker metadata
3. Waits for `command: 'start'`

### 2. Ready → Testing

**Trigger:** Admin clicks "Start Tests"
**Process:**
1. Orchestrator writes `command: 'start'` to all worker files
2. Worker detects command via `waitForCommand('start')`
3. Worker clears command with `clearCommand()`
4. Worker updates `state: 'testing'`
5. Playwright tests begin

### 3. Testing → Finished

**Trigger:** All tests complete naturally
**Process:**
1. Playwright tests finish
2. `upload-results.js` runs
3. Checks current state (not stopped)
4. Updates `state: 'finished'` with test results

### 4. Testing → Stopped

**Trigger:** Admin clicks "Stop Tests"
**Process:**
1. Orchestrator writes `command: 'stop'` to testing workers
2. `command-monitor.js` detects stop command
3. Clears command with `clearCommand()`
4. Updates `state: 'stopped'`
5. Kills Playwright process with SIGTERM
6. `upload-results.js` runs but preserves 'stopped' state

### 5. Stopped → Ready (Reset)

**Trigger:** Admin clicks "Reset"
**Process:**
1. Orchestrator updates stopped workers to `state: 'ready'`, `command: null`
2. Workers can now receive start command again

## Key Components

### Worker Side

#### `state-manager.js`
Central module for all state operations:
- `readState()` - Read current state from S3
- `updateState(state, data)` - Update worker state
- `waitForCommand(cmd)` - Block until specific command received
- `pollForCommand(callback)` - Continuously poll for commands
- `clearCommand()` - Clear command after processing

#### `startup.js`
Initial worker setup:
1. Report ready state
2. Wait for start command
3. Clear command and update to testing
4. Exit (Playwright takes over)

#### `command-monitor.js`
Background process that monitors for commands:
- Runs in parallel with Playwright tests
- Polls every 5 seconds for commands
- Handles stop command by updating state and killing tests

#### `upload-results.js`
Post-test cleanup:
1. Upload test results to S3
2. Check if already stopped
3. If not stopped, update to finished
4. Preserve stopped state if already set

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

## Migration Notes

### Removed Files
- `worker/stop-monitor.js` - Replaced by `command-monitor.js`
- `shared/storagePaths.js::getRunControlPath()` - No longer needed

### New Files
- `worker/state-manager.js` - State management module
- `worker/command-monitor.js` - Command polling service

### Modified Files
- `worker/startup.js` - Uses state-manager
- `worker/upload-results.js` - Preserves stopped state
- `worker/package.json` - References command-monitor
- `worker/Dockerfile` - Copies new files
- `orchestrator/src/services/runManager.js` - Writes commands not signals
- `web-ui/src/components/WorkerDashboard.jsx` - Shows new states
