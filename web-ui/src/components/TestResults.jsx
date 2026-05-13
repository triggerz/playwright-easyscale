import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function TestResults({ runId }) {
  const [results, setResults] = useState([])
  const [screenshots, setScreenshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedScreenshot, setSelectedScreenshot] = useState(null)
  const [expandedWorkers, setExpandedWorkers] = useState(new Set())

  useEffect(() => {
    loadResults()
    const interval = setInterval(loadResults, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [runId])

  const loadResults = async () => {
    try {
      const [resultsData, screenshotsData] = await Promise.all([
        api.getResults(runId),
        api.getScreenshots(runId)
      ])
      
      setResults(resultsData.results || [])
      setScreenshots(screenshotsData.screenshots || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleWorker = (workerIndex) => {
    const newExpanded = new Set(expandedWorkers)
    if (newExpanded.has(workerIndex)) {
      newExpanded.delete(workerIndex)
    } else {
      newExpanded.add(workerIndex)
    }
    setExpandedWorkers(newExpanded)
  }

  const getWorkerScreenshots = (workerIndex) => {
    return screenshots.filter(s => s.workerIndex === workerIndex)
  }

  const totalTests = results.reduce((sum, r) => sum + (r.total || 0), 0)
  const totalPassed = results.reduce((sum, r) => sum + (r.passed || 0), 0)
  const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0)
  const totalSkipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0)

  if (loading && results.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Results</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Loading results...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Test Results</h2>
        <button
          onClick={loadResults}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {results.length === 0 ? (
        <p className="text-gray-400">No results yet...</p>
      ) : (
        <>
          {/* Aggregated Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Total Tests</p>
              <p className="text-3xl font-bold text-blue-400">{totalTests}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">✓ Passed</p>
              <p className="text-3xl font-bold text-green-400">{totalPassed}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">✗ Failed</p>
              <p className="text-3xl font-bold text-red-400">{totalFailed}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">⊘ Skipped</p>
              <p className="text-3xl font-bold text-gray-400">{totalSkipped}</p>
            </div>
          </div>

          {/* Screenshots Section */}
          {screenshots.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Screenshots ({screenshots.length})</h3>
              <div className="grid grid-cols-6 gap-2">
                {screenshots.map((screenshot, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedScreenshot(screenshot)}
                    className="relative aspect-video bg-gray-900 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    <img
                      src={screenshot.url}
                      alt={screenshot.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                      <p className="text-xs text-white truncate">W{screenshot.workerIndex}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worker Details (Collapsed by default) */}
          <details className="bg-gray-700/50 rounded-lg p-4">
            <summary className="cursor-pointer font-semibold text-gray-300 hover:text-white transition-colors">
              Worker Details ({results.length} workers) - Click to expand
            </summary>
            <div className="mt-4 space-y-3">
              {results.map((result) => {
                const workerScreenshots = getWorkerScreenshots(result.shardIndex)
                const isExpanded = expandedWorkers.has(result.shardIndex)
                
                return (
                  <div key={result.shardIndex} className="bg-gray-700 rounded-lg">
                    <div
                      onClick={() => toggleWorker(result.shardIndex)}
                      className="p-4 cursor-pointer hover:bg-gray-600 transition-colors rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-lg font-semibold">
                            {isExpanded ? '▼' : '▶'} Worker {result.shardIndex}
                          </span>
                          <span className="text-sm text-gray-400">
                            Users {result.userRangeStart}-{result.userRangeEnd}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-green-400 font-semibold">{result.passed || 0} ✓</span>
                            <span className="text-red-400 font-semibold">{result.failed || 0} ✗</span>
                            <span className="text-gray-400">{result.skipped || 0} ⊘</span>
                          </div>
                          {workerScreenshots.length > 0 && (
                            <span className="text-sm text-blue-400">
                              📸 {workerScreenshots.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4">
                        {/* Result Details */}
                        <div className="bg-gray-800 rounded p-3 text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-400">Status:</span>
                              <span className="ml-2 text-white">{result.status}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Timestamp:</span>
                              <span className="ml-2 text-white">
                                {new Date(result.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Screenshots */}
                        {workerScreenshots.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-gray-300">Screenshots</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {workerScreenshots.map((screenshot, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setSelectedScreenshot(screenshot)}
                                  className="relative aspect-video bg-gray-900 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                                >
                                  <img
                                    src={screenshot.url}
                                    alt={screenshot.filename}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                                    <p className="text-xs text-white truncate">{screenshot.filename}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        </>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-6xl max-h-full overflow-auto">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedScreenshot.filename}</h3>
                  <p className="text-sm text-gray-400">Worker {selectedScreenshot.workerIndex}</p>
                </div>
                <button
                  onClick={() => setSelectedScreenshot(null)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                >
                  Close
                </button>
              </div>
              <img
                src={selectedScreenshot.url}
                alt={selectedScreenshot.filename}
                className="max-w-full h-auto rounded"
              />
              <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                <span>Size: {(selectedScreenshot.size / 1024).toFixed(2)} KB</span>
                <a
                  href={selectedScreenshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
