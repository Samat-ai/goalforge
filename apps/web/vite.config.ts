import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  test: {
    // Unit tests only — e2e/ belongs to Playwright (npm run test:e2e)
    include: ['src/**/*.test.{ts,tsx}'],
  },
  plugins: [
    {
      name: 'e2e-mode-guard',
      configResolved(config) {
        if (config.mode === 'production' && process.env.VITE_E2E_MODE === 'true') {
          throw new Error('VITE_E2E_MODE must not be set in production builds!')
        }
      }
    },
    react(),
    tailwindcss(),
  ],
})
