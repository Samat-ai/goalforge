import axios from 'axios'

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

// Auth token injection is handled by AuthInterceptor component

export default api
