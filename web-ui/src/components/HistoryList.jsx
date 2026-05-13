import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { getRunStatusColor } from '../utils/statusColors'
import { formatDate } from '../utils/dateFormatters'

function HistoryList({ onSelectRun }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRuns()
  }, [])

  const loadRuns = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getRuns()
      setRuns(data.runs || [])
    } catch (err) {
      console.error('Error loading runs:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRunClick = (run) => {
    onSelectRun(run.id)
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Run History</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Loading runs...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Run History</h2>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error loading runs: {error}</p>
          <button
            onClick={loadRuns}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Run History</h2>
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">No test runs found</p>
          <p className="text-gray-500 text-sm">Start a test to see it appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Test Run History</h2>
        <button
          onClick={loadRuns}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-3">
        {runs.map((run) => (
          <div
            key={run.id}
            onClick={() => handleRunClick(run)}
            className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getRunStatusColor(run.status)}`}>
                    {run.status}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {formatDate(run.startedAt)}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Test:</span>
                    <span className="text-white font-mono text-sm">{run.testFile}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Users:</span>
                      <span className="text-blue-400 font-semibold">{run.totalUsers}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Containers:</span>
                      <span className="text-green-400 font-semibold">{run.totalContainers}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Per Container:</span>
                      <span className="text-purple-400 font-semibold">{run.usersPerContainer}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRunClick(run)
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm"
                >
                  View Details →
                </button>
              </div>
            </div>

            {run.id && (
              <div className="mt-2 pt-2 border-t border-gray-600">
                <span className="text-gray-500 text-xs font-mono">{run.id}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default HistoryList
