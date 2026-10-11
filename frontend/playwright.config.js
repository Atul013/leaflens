import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: process.env.LEAFLENS_URL || 'http://127.0.0.1:8000',
    headless: true,
  },
  reporter: 'list',
  webServer: {
    command: 'python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: 'http://127.0.0.1:8000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
