/**
 * Centralized date formatting utilities
 * This ensures consistent date formatting across all components
 */

/**
 * Format a date string to a human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format duration from a start time to now
 * @param {string} startTime - ISO date string
 * @returns {string} Formatted duration (e.g., "5m 30s")
 */
export function formatDuration(startTime) {
  if (!startTime) return 'N/A'
  const start = new Date(startTime)
  const now = new Date()
  const diff = Math.floor((now - start) / 1000)
  const minutes = Math.floor(diff / 60)
  const seconds = diff % 60
  return `${minutes}m ${seconds}s`
}

/**
 * Format a date to a relative time string (e.g., "2 hours ago")
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time string
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  
  return formatDate(dateString)
}
