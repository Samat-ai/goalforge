import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'cross-env VITE_E2E_MODE=true VITE_E2E_USER_ID=user_e2e VITE_CLERK_PUBLISHABLE_KEY=pk_test_e2e VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/sign-in',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
