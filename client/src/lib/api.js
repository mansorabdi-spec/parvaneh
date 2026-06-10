import axios from 'axios'

// Use environment variable for API base URL
// In development: uses Vite proxy (/) or VITE_API_BASE_URL
// In production: uses VITE_API_BASE_URL from .env.production
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || '/'
export const normalizedApiBaseUrl = rawBaseURL.replace(/\/+$/, '')
const baseURL = normalizedApiBaseUrl || '/'

export const api = axios.create({ baseURL })

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => {
    // If response is successful, just return it
    return response
  },
  (error) => {
    // Check if error is due to unauthorized access (401)
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      console.log('🔒 Token expired or invalid. Logging out automatically...')
      
      // Clear token from storage and axios headers
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      
      // Dispatch custom event to notify components
      window.dispatchEvent(new Event('tokenChanged'))
      
      // Redirect to login page
      window.location.href = '/login'
    }
    
    // Return the error so it can still be handled by the calling code
    return Promise.reject(error)
  }
)

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
  }
  
  // Dispatch custom event to notify components that token has changed
  window.dispatchEvent(new Event('tokenChanged'))
}

export function initAuthFromStorage() {
  const token = localStorage.getItem('token')
  if (token) setAuthToken(token)
  return token
}
