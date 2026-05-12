import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function WorkerDashboard({ runId }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-green-500'
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
              className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
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
