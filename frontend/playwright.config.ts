import { defineConfig, devices } from '@playwright/test'

const testPython = process.env.BLOG_E2E_PYTHON || (process.platform === 'win32' ? '..\\.venv\\Scripts\\python.exe' : '../.venv/bin/python')

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:5174', channel: process.platform === 'win32' ? 'msedge' : undefined, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'wide', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: `"${testPython}" tests/serve.py`, url: 'http://127.0.0.1:8001/health', reuseExistingServer: false },
    { command: 'npm run dev -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', env: { BLOG_API_TARGET: 'http://127.0.0.1:8001' }, reuseExistingServer: false },
  ],
})
