import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { getRunStatusColor } from '../utils/statusColors'
import { formatDate } from '../utils/dateFormatters'

function HistoryList({ onSelectRun }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedRuns, setSelectedRuns] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
    if (!selectionMode) {
      onSelectRun(run.id)
    }
  }

  const isDeletable = (run) => {
    return ['completed', 'stopped', 'stopping', 'failed', 'deleted'].includes(run.status)
  }

  const toggleSelection = (runId) => {
    const newSelected = new Set(selectedRuns)
    if (newSelected.has(runId)) {
      newSelected.delete(runId)
    } else {
      newSelected.add(runId)
    }
    setSelectedRuns(newSelected)
  }

  const toggleSelectAll = () => {
    const deletableRuns = runs.filter(isDeletable)
    if (selectedRuns.size === deletableRuns.length) {
      setSelectedRuns(new Set())
    } else {
      setSelectedRuns(new Set(deletableRuns.map(r => r.id)))
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const runIdsToDelete = Array.from(selectedRuns)
      await api.bulkDeleteRunData(runIdsToDelete)
      
      // Refresh the list
      await loadRuns()
      
      // Exit selection mode and clear selections
      setSelectionMode(false)
      setSelectedRuns(new Set())
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Error deleting runs:', err)
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const cancelSelection = () => {
    setSelectionMode(false)
    setSelectedRuns(new Set())
  }

  const deletableRuns = runs.filter(isDeletable)
  const allSelected = deletableRuns.length > 0 && selectedRuns.size === deletableRuns.length

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
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors text-sm"
              >
                🗑️ Select to Delete
              </button>
              <button
                onClick={loadRuns}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
              >
                🔄 Refresh
              </button>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                <span className="text-sm">Select All ({deletableRuns.length})</span>
              </label>
              <button
                onClick={cancelSelection}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedRuns.size === 0}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ Delete ({selectedRuns.size})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {runs.map((run) => {
          const canDelete = isDeletable(run)
          const isSelected = selectedRuns.has(run.id)
          
          return (
            <div
              key={run.id}
              onClick={() => selectionMode && canDelete ? toggleSelection(run.id) : handleRunClick(run)}
              className={`bg-gray-700 rounded-lg p-4 transition-colors ${
                selectionMode && canDelete ? 'cursor-pointer hover:bg-gray-600' : 
                selectionMode ? 'opacity-50 cursor-not-allowed' :
                'cursor-pointer hover:bg-gray-600'
              } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-start justify-between">
                {selectionMode && (
                  <div className="mr-3 pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canDelete}
                      onChange={() => toggleSelection(run.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>
                )}
                
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

                {!selectionMode && (
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
                )}
              </div>

              {run.id && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <span className="text-gray-500 text-xs font-mono">{run.id}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4 text-red-400">⚠️ Delete {selectedRuns.size} Test Record{selectedRuns.size > 1 ? 's' : ''}?</h3>
            
            <div className="mb-4 space-y-2">
              <p className="text-gray-300">This will permanently delete all data for:</p>
              <ul className="list-disc list-inside text-sm text-gray-400 max-h-40 overflow-y-auto">
                {Array.from(selectedRuns).map(runId => {
                  const run = runs.find(r => r.id === runId)
                  return (
                    <li key={runId}>
                      {run?.testFile} - {run?.totalUsers} users ({formatDate(run?.startedAt)})
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 mb-4">
              <p className="text-yellow-200 text-sm">
                Each record includes:
              </p>
              <ul className="text-yellow-200 text-sm list-disc list-inside ml-2">
                <li>All screenshots and videos</li>
                <li>All test results</li>
                <li>All logs</li>
              </ul>
            </div>

            <p className="text-red-400 font-semibold mb-6">This action cannot be undone!</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Permanently'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HistoryList
