import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from "@sentry/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV === "production"
      ? [sentryVitePlugin({ org: "goalforge", project: "goalforge-web", authToken: process.env.SENTRY_AUTH_TOKEN })]
      : []),
  ],
  build: {
    sourcemap: true,
  },
})
