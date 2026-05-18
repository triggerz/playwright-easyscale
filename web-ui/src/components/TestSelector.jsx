import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function TestSelector({ selectedTest, onSelectTest }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTests()
  }, [])

  const loadTests = async () => {
    try {
      setLoading(true)
      const data = await api.getTests()
      setTests(data.tests || [])
    } catch (err) {
      console.error('Error loading tests:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
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
        <p className="font-semibold">Error loading tests</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadTests}
          className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Available Tests</h2>
      
      {tests.length === 0 ? (
        <p className="text-gray-400">No tests found. Add test files to worker/tests/</p>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <button
              key={test.file}
              onClick={() => onSelectTest(test)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedTest?.file === test.file
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-blue-400">
                    {test.metadata?.name || test.file}
                  </h3>
                  {test.metadata?.description && (
                    <p className="text-gray-400 text-sm mt-1">
                      {test.metadata.description}
                    </p>
                  )}
                  <p className="text-gray-500 text-xs mt-2">
                    📁 {test.file}
                  </p>
                </div>
                {selectedTest?.file === test.file && (
                  <div className="ml-4">
                    <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs rounded-full">
                      Selected
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
