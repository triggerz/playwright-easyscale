import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function WorkerDashboard({ runId }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startingTests, setStartingTests] = useState(false)
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
    try {
      setStartingTests(true)
      setError('')
      await api.startRun(runId)
      await loadWorkers()
    } catch (err) {
      setError(err.message)
    } finally {
      setStartingTests(false)
    }
  }

  const handleDeleteWorkers = async () => {
    if (!confirm('Are you sure you want to delete all workers? This will stop any running tests.')) {
      return
    }
    
    try {
      setDeletingWorkers(true)
      setError('')
      await api.deleteWorkers(runId)
      await loadWorkers()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingWorkers(false)
    }
  }

  const allWorkersReady = workers.length > 0 && workers.every(w => w.status === 'ready')
  const anyWorkerRunning = workers.some(w => w.status === 'running')

  const getStatusColor = (status) => {
    switch (status) {
      case 'deploying':
        return 'bg-orange-500'
      case 'ready':
        return 'bg-green-500'
      case 'running':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-green-600'
      case 'failed':
        return 'bg-red-500'
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
        return '✓'
      case 'running':
        return '⚡'
      case 'completed':
        return '✅'
      case 'failed':
        return '❌'
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
      case 'completed':
        return 'bg-green-900/30 border-green-700'
      case 'failed':
        return 'bg-red-900/20 border-red-700/50'
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
                      Container {worker.index}
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
                  {worker.completedTests !== undefined && (
                    <p className="text-xs text-gray-400 mt-1">
                      {worker.completedTests}/{worker.totalTests} tests
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {worker.totalTests > 0 && (
                <div className="mt-3">
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(worker.completedTests / worker.totalTests) * 100}%`
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
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={handleStartTests}
            disabled={!allWorkersReady || anyWorkerRunning || startingTests}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
          >
            {startingTests ? (
              <>
                <span className="animate-spin">⚙️</span>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Start Tests</span>
              </>
            )}
          </button>
          
          {allWorkersReady && (
            <p className="text-sm text-green-400">
              ✓ All workers ready! Click "Start Tests" to begin.
            </p>
          )}
          
          {!allWorkersReady && !anyWorkerRunning && (
            <p className="text-sm text-orange-400">
              ⏳ Waiting for workers to be ready...
            </p>
          )}
          
          <button
            onClick={handleDeleteWorkers}
            disabled={deletingWorkers}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
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
              {workers.filter(w => w.status === 'completed').length}
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
