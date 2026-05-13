import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'

export default function LogViewer({ runId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [autoScroll, setAutoScroll] = useState(false)
  const logsEndRef = useRef(null)

  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [runId])

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const loadLogs = async () => {
    try {
      const data = await api.getLogs(runId)
      setLogs(data.logs || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getLogColor = (level) => {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      case 'success':
        return 'text-green-400'
      default:
        return 'text-gray-300'
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Logs</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            <span className="text-gray-400">Auto-scroll</span>
          </label>
          <button
            onClick={loadLogs}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
        {loading && logs.length === 0 ? (
          <p className="text-gray-500">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500">No logs yet...</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="flex space-x-2">
                <span className="text-gray-500 flex-shrink-0">
                  {log.timestamp || new Date().toISOString().split('T')[1].split('.')[0]}
                </span>
                <span className={`flex-shrink-0 ${getLogColor(log.level)}`}>
                  [{log.level?.toUpperCase() || 'INFO'}]
                </span>
                {log.worker && (
                  <span className="text-purple-400 flex-shrink-0">
                    [Worker {log.worker}]
                  </span>
                )}
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
