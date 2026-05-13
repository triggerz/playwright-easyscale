import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function WorkerDashboard({ runId }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startingTests, setStartingTests] = useState(false)
  const [stoppingTests, setStoppingTests] = useState(false)
  const [resettingRun, setResettingRun] = useState(false)
  const [deletingWorkers, setDeletingWorkers] = useState(false)

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
      console.log('Delete result:', result)
      await loadWorkers()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingWorkers(false)
    }
  }

  const allWorkersReady = workers.length > 0 && workers.every(w => w.status === 'ready')
  const anyWorkerRunning = workers.some(w => w.status === 'running')
  const allWorkersFinished = workers.length > 0 && workers.every(w => ['completed', 'completed-with-failures', 'failed', 'stopped'].includes(w.status))
  const canReset = workers.length > 0 && workers.some(w => w.status === 'stopped')

  const getStatusColor = (status) => {
    switch (status) {
      case 'deploying':
        return 'bg-orange-500'
      case 'ready':
        return 'bg-green-500'
      case 'running':
        return 'bg-blue-500'
      case 'stopping':
        return 'bg-yellow-500'
      case 'stopped':
        return 'bg-gray-500'
      case 'completed':
        return 'bg-green-600'
      case 'completed-with-failures':
        return 'bg-orange-600'
      case 'failed':
        return 'bg-red-500'
      case 'deleted':
        return 'bg-gray-700'
      case 'pending':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'deploying':
        return '🚀'
      case 'ready':
        return '👷'
      case 'running':
        return '⚡'
      case 'stopping':
        return '⏸️'
      case 'stopped':
        return '⏹️'
      case 'completed':
        return '✅'
      case 'completed-with-failures':
        return '⚠️'
      case 'failed':
        return '❌'
      case 'deleted':
        return '🗑️'
      case 'pending':
        return '⏳'
      default:
        return '❓'
    }
  }

  const getContainerBgColor = (status) => {
    switch (status) {
      case 'deploying':
        return 'bg-orange-900/20 border-orange-700/50'
      case 'ready':
        return 'bg-green-900/20 border-green-700/50'
      case 'running':
        return 'bg-blue-900/20 border-blue-700/50'
      case 'stopping':
        return 'bg-yellow-900/20 border-yellow-700/50'
      case 'stopped':
        return 'bg-gray-900/20 border-gray-700/50'
      case 'completed':
        return 'bg-green-900/30 border-green-700'
      case 'completed-with-failures':
        return 'bg-orange-900/30 border-orange-700'
      case 'failed':
        return 'bg-red-900/20 border-red-700/50'
      case 'deleted':
        return 'bg-gray-900/30 border-gray-800'
      default:
        return 'bg-gray-700/50 border-gray-600'
    }
  }

  if (loading && workers.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Worker Status</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-700 rounded"></div>
          <div className="h-16 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Worker Status</h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-400">Live</span>
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
        <div className="space-y-3">
          {workers.map((worker) => (
            <div
              key={worker.index}
              className={`rounded-lg p-4 border ${getContainerBgColor(worker.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getStatusIcon(worker.status)}</span>
                  <div>
                    <h3 className="font-semibold">
                      Worker {worker.index}
                    </h3>
                    <p className="text-sm text-gray-400">
                      Users {worker.startUser}-{worker.endUser} ({worker.userCount} users)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                   <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(worker.status)} text-white`}>
                     {worker.status}
                   </span>
                   {(worker.passed !== undefined || worker.failed !== undefined) && (
                     <p className="text-xs text-gray-400 mt-1">
                       {worker.passed || 0} passed, {worker.failed || 0} failed
                     </p>
                   )}
                </div>
              </div>

              {/* Progress Bar */}
              {worker.total > 0 && (
                <div className="mt-3">
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${((worker.passed + worker.failed) / worker.total) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              )}
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
                disabled={!allWorkersReady || anyWorkerRunning || startingTests}
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
                disabled={!anyWorkerRunning || stoppingTests}
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
              disabled={!allWorkersFinished || deletingWorkers}
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
          <div className="text-sm">
            {allWorkersReady && !anyWorkerRunning && (
              <p className="text-green-400">
                ✓ All workers ready! Click "Start Tests" to begin.
              </p>
            )}
            
            {!allWorkersReady && !anyWorkerRunning && !allWorkersFinished && (
              <p className="text-orange-400">
                ⏳ Waiting for workers to be ready...
              </p>
            )}
            
            {anyWorkerRunning && (
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
              {workers.filter(w => w.status === 'completed' || w.status === 'completed-with-failures').length}
            </p>
            <p className="text-xs text-gray-400">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">
              {workers.filter(w => w.status === 'running').length}
            </p>
            <p className="text-xs text-gray-400">Running</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">
              {workers.filter(w => w.status === 'failed').length}
            </p>
            <p className="text-xs text-gray-400">Failed</p>
          </div>
        </div>
      )}
    </div>
  )
}
