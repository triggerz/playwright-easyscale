/**
 * Centralized status color utilities
 * This ensures consistent status colors across all components
 */

/**
 * Get Tailwind background color class for a run status
 * @param {string} status - Run status (pending, deploying, running, etc.)
 * @returns {string} Tailwind CSS class
 */
export function getRunStatusColor(status) {
  const colors = {
    pending: 'bg-yellow-500',
    deploying: 'bg-blue-500',
    running: 'bg-green-500',
    stopping: 'bg-orange-500',
    stopped: 'bg-gray-500',
    completed: 'bg-green-600',
    deleted: 'bg-red-500',
    ready: 'bg-cyan-500',
    failed: 'bg-red-500'
  }
  return colors[status] || 'bg-gray-500'
}

/**
 * Get Tailwind background color class for a worker state
 * @param {string} state - Worker state (deploying, ready, testing, etc.)
 * @returns {string} Tailwind CSS class
 */
export function getWorkerStateColor(state) {
  const colors = {
    deploying: 'bg-orange-500',
    ready: 'bg-green-500',
    testing: 'bg-blue-500',
    stopped: 'bg-gray-500',
    finished: 'bg-green-600',
    deleted: 'bg-gray-700'
  }
  return colors[state] || 'bg-gray-500'
}

/**
 * Get status icon emoji for a worker state
 * @param {string} state - Worker state
 * @returns {string} Emoji icon
 */
export function getWorkerStateIcon(state) {
  const icons = {
    deploying: '🚀',
    ready: '👷',
    testing: '⚡',
    stopped: '⏹️',
    finished: '✅',
    deleted: '🗑️'
  }
  return icons[state] || '❓'
}

/**
 * Get container background color for a worker state
 * @param {string} state - Worker state
 * @returns {string} Tailwind CSS classes for background and border
 */
export function getWorkerContainerColor(state) {
  const colors = {
    deploying: 'bg-orange-900/20 border-orange-700/50',
    ready: 'bg-green-900/20 border-green-700/50',
    testing: 'bg-blue-900/20 border-blue-700/50',
    stopped: 'bg-gray-900/20 border-gray-700/50',
    finished: 'bg-green-900/30 border-green-700',
    deleted: 'bg-gray-900/30 border-gray-800'
  }
  return colors[state] || 'bg-gray-700/50 border-gray-600'
}
