import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
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
