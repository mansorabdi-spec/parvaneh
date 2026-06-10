import { api } from '../lib/api.js'

/**
 * Log a license print event to the database
 * @param {number} requestId - The request ID
 * @param {string} trackingNo - The tracking number
 * @param {string} licenseType - Type of license: 'Activity', 'Exploitation', 'Employment', 'LegalEntity'
 * @returns {Promise} - Promise that resolves when log is saved
 */
export const logLicensePrint = async (requestId, trackingNo, licenseType) => {
  try {
    const response = await api.post('/api/printlog/log', {
      requestId,
      trackingNo,
      licenseType
    })
    console.log('✅ License print logged:', response.data)
    return response.data
  } catch (error) {
    console.error('❌ Error logging license print:', error)
    // Don't throw error - logging should not block printing
    return null
  }
}

/**
 * Check if a request has been printed before
 * @param {number} requestId - The request ID
 * @returns {Promise<Object>} - Object with isPrinted, printCount, lastPrintedAt, lastPrintedBy
 */
export const checkIfPrinted = async (requestId) => {
  try {
    const response = await api.get(`/api/printlog/check/${requestId}`)
    return response.data
  } catch (error) {
    console.error('Error checking print status:', error)
    return { isPrinted: false, printCount: 0 }
  }
}

/**
 * Get print logs for a specific request
 * @param {number} requestId - The request ID
 * @returns {Promise<Array>} - Array of print logs
 */
export const getPrintLogs = async (requestId) => {
  try {
    const response = await api.get(`/api/printlog/request/${requestId}`)
    return response.data
  } catch (error) {
    console.error('Error fetching print logs:', error)
    return { logs: [], totalPrints: 0 }
  }
}
