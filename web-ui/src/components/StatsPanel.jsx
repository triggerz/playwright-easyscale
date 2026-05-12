import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function StatsPanel({ runId }) {
  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRun()
    const interval = setInterval(loadRun, 3000) // Poll every 3 seconds
    return () => clearInterval(interval)
  }, [runId])

  const loadRun = async () => {
    try {
      const data = await api.getRun(runId)
      setRun(data)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    if (!confirm('Are you sure you want to stop this test run?')) return

    try {
      await api.stopRun(runId)
      await loadRun()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
        {error}
      </div>
    )
  }

  if (!run) return null

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

  const formatDuration = (startTime) => {
    if (!startTime) return 'N/A'
    const start = new Date(startTime)
    const now = new Date()
    const diff = Math.floor((now - start) / 1000)
    const minutes = Math.floor(diff / 60)
    const seconds = diff % 60
    return `${minutes}m ${seconds}s`
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">{run.testFile}</h2>
          <p className="text-gray-400 text-sm">Run ID: {run.id}</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(run.status)} text-white`}>
            {run.status}
          </span>
          {run.status === 'running' && (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
            >
              🛑 Stop
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Total Users</p>
          <p className="text-3xl font-bold text-blue-400">{run.totalUsers}</p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Containers</p>
          <p className="text-3xl font-bold text-purple-400">
            {run.totalContainers || Math.ceil(run.totalUsers / run.usersPerContainer)}
          </p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Duration</p>
          <p className="text-3xl font-bold text-green-400">
            {formatDuration(run.startedAt)}
          </p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Est. Cost</p>
          <p className="text-3xl font-bold text-yellow-400">
            ${((run.totalContainers || Math.ceil(run.totalUsers / run.usersPerContainer)) * 0.02).toFixed(2)}
          </p>
        </div>
      </div>

      {run.startedAt && (
        <div className="mt-4 text-sm text-gray-400">
          Started: {new Date(run.startedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}
