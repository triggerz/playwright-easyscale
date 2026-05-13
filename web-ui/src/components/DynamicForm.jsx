import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function DynamicForm({ test, onStart }) {
  // Load saved values from localStorage
  const loadSavedFormData = () => {
    try {
      const saved = localStorage.getItem(`test-form-${test.file}`)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved form data:', error)
    }
    return {
      totalUsers: 20,
      usersPerContainer: 5,
      parameters: {}
    }
  }

  const [formData, setFormData] = useState(loadSavedFormData())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(`test-form-${test.file}`, JSON.stringify(formData))
    } catch (error) {
      console.error('Failed to save form data:', error)
    }
  }, [formData, test.file])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.createRun({
        testFile: test.file,
        totalUsers: formData.totalUsers,
        usersPerContainer: formData.usersPerContainer,
        parameters: formData.parameters
      })
      onStart(response.runId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateParameter = (key, value) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value
      }
    }))
  }

  const renderParameterInput = (param) => {
    const value = formData.parameters[param.key] || param.default || ''

    switch (param.type) {
      case 'string':
      case 'url':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateParameter(param.key, e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            placeholder={param.default || `Enter ${param.label}`}
            required={param.required}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateParameter(param.key, parseInt(e.target.value))}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            placeholder={param.default || `Enter ${param.label}`}
            required={param.required}
          />
        )

      case 'array':
        return (
          <div className="space-y-2">
            <textarea
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  updateParameter(param.key, parsed)
                } catch {
                  updateParameter(param.key, e.target.value)
                }
              }}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white font-mono text-sm"
              rows={6}
              placeholder={`Enter JSON array for ${param.label}`}
              required={param.required}
            />
            <p className="text-xs text-gray-400">
              💡 Enter as JSON array. Example: {`[{"email": "user1@example.com", "password": "pass123"}]`}
            </p>
          </div>
        )

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateParameter(param.key, e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            placeholder={`Enter ${param.label}`}
            required={param.required}
          />
        )
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Configure Test Run</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Total Users
            </label>
            <input
              type="number"
              value={formData.totalUsers}
              onChange={(e) => setFormData(prev => ({ ...prev, totalUsers: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Users per Container
            </label>
            <input
              type="number"
              value={formData.usersPerContainer}
              onChange={(e) => setFormData(prev => ({ ...prev, usersPerContainer: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              min="1"
              required
            />
          </div>
        </div>

        {/* Calculated Info */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-300">
            📊 This will deploy <span className="font-semibold text-blue-400">
              {Math.ceil(formData.totalUsers / formData.usersPerContainer)} containers
            </span> to Railway
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Estimated cost: ~${(Math.ceil(formData.totalUsers / formData.usersPerContainer) * 0.02).toFixed(2)} for 30 minutes
          </p>
        </div>

        {/* Test-Specific Parameters */}
        {test.metadata?.parameters && test.metadata.parameters.length > 0 && (
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4">Test Parameters</h3>
            <div className="space-y-4">
              {test.metadata.parameters.map((param) => (
                <div key={param.key}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {param.label}
                    {param.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {param.description && (
                    <p className="text-xs text-gray-400 mb-2">{param.description}</p>
                  )}
                  {renderParameterInput(param)}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            ⚠️ This will deploy containers to Railway and incur costs
          </p>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? '⚙️ Preparing...' : '⚙️ Prepare Workers'}
          </button>
        </div>
      </form>
    </div>
  )
}
