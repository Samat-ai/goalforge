import axios from 'axios'
import { parseApiError } from './api-error'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// Attach browser timezone to every request for silent backend sync
api.interceptors.request.use((config) => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) {
      config.headers['X-User-Timezone'] = tz
    }
  } catch {
    // Intl not available — skip silently
  }
  return config
})

// Convert non-2xx responses into typed ApiError instances
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      throw parseApiError(error.response.status, error.response.data)
    }
    // Network error / timeout — no response object
    throw error
  },
)

// Auth token injection is handled by AuthInterceptor component

export default api
