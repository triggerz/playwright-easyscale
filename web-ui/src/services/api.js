/**
 * API service for communicating with the orchestrator backend
 */

class ApiService {
  constructor() {
    const baseUrl = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3000'
    this.baseUrl = `${baseUrl}/api`
    this.token = null
  }

  setToken(token) {
    this.token = token
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Auth
  async login(passphrase) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ passphrase }),
    })
  }

  // Tests
  async getTests() {
    return this.request('/tests')
  }

  async getTestSchema(testFile) {
    return this.request(`/tests/${encodeURIComponent(testFile)}/schema`)
  }

  // Runs
  async createRun(data) {
    return this.request('/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getRuns() {
    return this.request('/runs')
  }

  async getRun(runId) {
    return this.request(`/runs/${runId}`)
  }

  async getWorkers(runId) {
    return this.request(`/runs/${runId}/workers`)
  }

  async getLogs(runId) {
    return this.request(`/runs/${runId}/logs`)
  }

  async startRun(runId) {
    return this.request(`/runs/${runId}/start`, {
      method: 'POST',
    })
  }

  async stopRun(runId) {
    return this.request(`/runs/${runId}/stop`, {
      method: 'POST',
    })
  }

  async resetRun(runId) {
    return this.request(`/runs/${runId}/reset`, {
      method: 'POST',
    })
  }

  async deleteWorkers(runId) {
    return this.request(`/runs/${runId}/workers`, {
      method: 'DELETE',
    })
  }

  // Stats
  async getStats() {
    return this.request('/stats')
  }
}

export const api = new ApiService()
