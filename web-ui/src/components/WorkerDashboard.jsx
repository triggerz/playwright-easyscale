import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { getWorkerStateColor, getWorkerStateIcon, getWorkerContainerColor } from '../utils/statusColors'

export default function WorkerDashboard({ runId }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startingTests, setStartingTests] = useState(false)
  const [stoppingTests, setStoppingTests] = useState(false)
  const [resettingRun, setResettingRun] = useState(false)
  const [deletingWorkers, setDeletingWorkers] = useState(false)
  const [redeployingWorker, setRedeployingWorker] = useState(null)
  const [showPartialStartConfirm, setShowPartialStartConfirm] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    loadWorkers()
    const interval = setInterval(loadWorkers, 3000) // Poll every 3 seconds
    return () => clearInterval(interval)
  }, [runId])

  const loadWorkers = async () => {
    try {
      const data = await api.getWorkers(runId)
      setWorkers(data.workers || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTests = async () => {
    if (startingTests) return // Prevent double-click
    
    try {
      setStartingTests(true)
      setError('')
      await api.startRun(runId)
      await loadWorkers()
      setStartingTests(false)
    } catch (err) {
      setError(err.message)
      setStartingTests(false)
    }
  }

  const handleStopTests = async () => {
    if (!confirm('Are you sure you want to stop all running tests?')) {
      return
    }
    
    try {
      setStoppingTests(true)
      setError('')
      await api.stopRun(runId)
      await loadWorkers()
    } catch (err) {
      setError(err.message)
    } finally {
      setStoppingTests(false)
    }
  }

  const handleResetRun = async () => {
    if (!confirm('Reset workers to ready state? This will clear the stop signal.')) {
      return
    }
    
    try {
      setResettingRun(true)
      setError('')
      await api.resetRun(runId)
      await loadWorkers()
    } catch (err) {
      setError(err.message)
    } finally {
      setResettingRun(false)
    }
  }

  const handleDeleteWorkers = async () => {
    if (!confirm('Are you sure you want to delete all workers? This action cannot be undone.')) {
      return
    }
    
    try {
      setDeletingWorkers(true)
      setError('')
      const result = await api.deleteWorkers(runId)
      await loadWorkers()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingWorkers(false)
    }
  }

  const handleRedeployWorker = async (workerIndex) => {
    if (!confirm(`Are you sure you want to redeploy worker ${workerIndex}? This will delete and recreate the worker service.`)) {
      return
    }
    
    try {
      setRedeployingWorker(workerIndex)
      setError('')
      await api.redeployWorker(runId, workerIndex)
      await loadWorkers()
    } catch (err) {
      setError(err.message)
    } finally {
      setRedeployingWorker(null)
    }
  }

  const handleStartPartial = async () => {
    try {
      setStartingTests(true)
      setError('')
      const result = await api.startRunPartial(runId)
      await loadWorkers()
      setShowPartialStartConfirm(false)
      setStartingTests(false)
    } catch (err) {
      setError(err.message)
      setStartingTests(false)
    }
  }

  const allWorkersReady = workers.length > 0 && workers.every(w => w.state === 'ready')
  const anyWorkerTesting = workers.some(w => w.state === 'testing')
  const allWorkersFinished = workers.length > 0 && workers.every(w => ['finished', 'stopped'].includes(w.state))
  const canReset = workers.length > 0 && workers.some(w => w.state === 'stopped')
  const canDeleteWorkers = workers.length > 0 && !anyWorkerTesting
  const someWorkersReady = workers.some(w => w.state === 'ready')
  const readyWorkersCount = workers.filter(w => w.state === 'ready').length

  if (loading && workers.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Worker Pool</h2>
        <div className="animate-pulse grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Worker Pool</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setRecoveryMode(!recoveryMode)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              recoveryMode 
                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {recoveryMode ? '🔧 Recovery Mode ON' : '🔧 Recovery Mode'}
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">Live</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {workers.length === 0 ? (
        <p className="text-gray-400">No workers deployed yet...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {workers.map((worker) => (
            <div
              key={worker.index}
              className={`rounded-lg p-4 border ${getWorkerContainerColor(worker.state || worker.status)} flex flex-col relative overflow-hidden`}
            >
              {/* Large background emoji */}
              <div className="absolute top-0 right-0 text-8xl opacity-10 pointer-events-none">
                {getWorkerStateIcon(worker.state || worker.status)}
              </div>
              
              {/* Content */}
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">
                    Worker {worker.index}
                  </h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getWorkerStateColor(worker.state || worker.status)} text-white flex-shrink-0`}>
                    {worker.state || worker.status}
                  </span>
                </div>
                
                <p className="text-xs text-gray-400 mb-2">
                  Users {worker.startUser}-{worker.endUser}
                </p>
                
                {(worker.passed !== undefined || worker.failed !== undefined) && (
                  <div className="text-xs mb-2">
                    <span className="text-green-400">{worker.passed || 0} ✓</span>
                    {' / '}
                    <span className="text-red-400">{worker.failed || 0} ✗</span>
                  </div>
                )}

                {/* Redeploy button - only show in recovery mode and if worker is not testing */}
                {recoveryMode && worker.state !== 'testing' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRedeployWorker(worker.index)
                    }}
                    disabled={redeployingWorker === worker.index}
                    className="mt-auto px-2 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors flex items-center justify-center space-x-1"
                  >
                    {redeployingWorker === worker.index ? (
                      <>
                        <span className="animate-spin">⚙️</span>
                        <span>Redeploying...</span>
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        <span>Redeploy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {workers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleStartTests}
                disabled={!allWorkersReady || anyWorkerTesting || startingTests}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
              >
                {startingTests ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <span>▶️</span>
                    <span>Start Tests</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleStopTests}
                disabled={!anyWorkerTesting || stoppingTests}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
              >
                {stoppingTests ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    <span>Stopping...</span>
                  </>
                ) : (
                  <>
                    <span>⏹️</span>
                    <span>Stop Tests</span>
                  </>
                )}
              </button>

              <button
                onClick={handleResetRun}
                disabled={!canReset || resettingRun}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
              >
                {resettingRun ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Reset</span>
                  </>
                )}
              </button>
            </div>
            
            <button
              onClick={handleDeleteWorkers}
              disabled={!canDeleteWorkers || deletingWorkers}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              {deletingWorkers ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <span>🗑️</span>
                  <span>Delete Workers</span>
                </>
              )}
            </button>
          </div>
          
          {/* Status Messages */}
          <div className="text-sm space-y-2">
            {allWorkersReady && !anyWorkerTesting && (
              <p className="text-green-400">
                ✓ All workers ready! Click "Start Tests" to begin.
              </p>
            )}
            
            {!allWorkersReady && !anyWorkerTesting && !allWorkersFinished && someWorkersReady && (
              <div className="flex items-center justify-between bg-orange-900/30 border border-orange-700 rounded p-2">
                <p className="text-orange-400">
                  ⏳ {readyWorkersCount}/{workers.length} workers ready. Some workers are not ready yet.
                </p>
                {recoveryMode && (
                  <button
                    onClick={() => setShowPartialStartConfirm(true)}
                    disabled={startingTests}
                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  >
                    Start Anyway
                  </button>
                )}
              </div>
            )}

            {!allWorkersReady && !anyWorkerTesting && !allWorkersFinished && !someWorkersReady && (
              <p className="text-orange-400">
                ⏳ Waiting for workers to be ready...
              </p>
            )}
            
            {anyWorkerTesting && (
              <p className="text-blue-400">
                ⚡ Tests running... Click "Stop Tests" to halt execution.
              </p>
            )}
            
            {canReset && (
              <p className="text-yellow-400">
                🔄 Workers stopped. Click "Reset" to prepare for another run, or "Delete Workers" to clean up.
              </p>
            )}
            
            {allWorkersFinished && !canReset && (
              <p className="text-gray-400">
                ⏹️ All workers finished. Click "Delete Workers" to clean up.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {workers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-400">
              {workers.length}
            </p>
            <p className="text-xs text-gray-400">Total Workers</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">
              {workers.filter(w => w.state === 'finished').length}
            </p>
            <p className="text-xs text-gray-400">Finished</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">
              {workers.filter(w => w.state === 'testing').length}
            </p>
            <p className="text-xs text-gray-400">Testing</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-400">
              {workers.filter(w => w.state === 'stopped').length}
            </p>
            <p className="text-xs text-gray-400">Stopped</p>
          </div>
        </div>
      )}

      {/* Partial Start Confirmation Modal */}
      {showPartialStartConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4 text-orange-400">⚠️ Start with Partial Workers?</h3>
            
            <div className="mb-4 space-y-2">
              <p className="text-gray-300">
                Only {readyWorkersCount} out of {workers.length} workers are ready.
              </p>
              <p className="text-gray-400 text-sm">
                Starting now will only run tests on the ready workers. The other workers will not participate in this test run.
              </p>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 mb-4">
              <p className="text-yellow-200 text-sm">
                This may result in incomplete test coverage. Consider waiting for all workers or redeploying failed workers.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPartialStartConfirm(false)}
                disabled={startingTests}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartPartial}
                disabled={startingTests}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {startingTests ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Starting...
                  </>
                ) : (
                  'Start Anyway'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
