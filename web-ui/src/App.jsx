import { useState, useEffect } from 'react'
import LoginForm from './components/Auth/LoginForm'
import TestSelector from './components/TestSelector'
import DynamicForm from './components/DynamicForm'
import WorkerDashboard from './components/WorkerDashboard'
import LogViewer from './components/LogViewer'
import StatsPanel from './components/StatsPanel'
import HistoryList from './components/HistoryList'
import { api } from './services/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [selectedTest, setSelectedTest] = useState(null)
  const [currentRun, setCurrentRun] = useState(null)
  const [view, setView] = useState('tests') // 'tests', 'running', 'history'

  useEffect(() => {
    // Check if already authenticated
    const token = localStorage.getItem('auth_token')
    if (token) {
      api.setToken(token)
      setIsAuthenticated(true)
    }
    
    // Restore view and currentRun from sessionStorage
    const savedView = sessionStorage.getItem('currentView')
    const savedRunId = sessionStorage.getItem('currentRunId')
    if (savedView) {
      setView(savedView)
    }
    if (savedRunId) {
      setCurrentRun(savedRunId)
    }
  }, [])
  
  // Persist view and currentRun to sessionStorage
  useEffect(() => {
    if (view) {
      sessionStorage.setItem('currentView', view)
    }
  }, [view])
  
  useEffect(() => {
    if (currentRun) {
      sessionStorage.setItem('currentRunId', currentRun)
    } else {
      sessionStorage.removeItem('currentRunId')
    }
  }, [currentRun])

  const handleLogin = (token) => {
    localStorage.setItem('auth_token', token)
    api.setToken(token)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    sessionStorage.removeItem('currentView')
    sessionStorage.removeItem('currentRunId')
    api.setToken(null)
    setIsAuthenticated(false)
    setSelectedTest(null)
    setCurrentRun(null)
  }

  const handleTestStart = (runId) => {
    setCurrentRun(runId)
    setView('running')
  }

  const handleSelectRun = (runId) => {
    setCurrentRun(runId)
    setView('running')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoginForm onLogin={handleLogin} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-blue-400">
                🚀 Playwright EasyScale
              </h1>
              <nav className="flex space-x-2">
                <button
                  onClick={() => setView('tests')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    view === 'tests'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Tests
                </button>
                <button
                  onClick={() => setView('running')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    view === 'running'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!currentRun}
                >
                  Running
                </button>
                <button
                  onClick={() => setView('history')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    view === 'history'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  History
                </button>
              </nav>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'tests' ? (
          <div className="space-y-6">
            <TestSelector
              selectedTest={selectedTest}
              onSelectTest={setSelectedTest}
            />
            {selectedTest && (
              <DynamicForm
                test={selectedTest}
                onStart={handleTestStart}
              />
            )}
          </div>
        ) : view === 'running' && currentRun ? (
          <div className="space-y-6">
            <StatsPanel runId={currentRun} />
            <WorkerDashboard runId={currentRun} />
            <LogViewer runId={currentRun} />
          </div>
        ) : view === 'history' ? (
          <HistoryList onSelectRun={handleSelectRun} />
        ) : null}
      </main>
    </div>
  )
}

export default App
