import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  timeout: 30000, outputDir: 'work/playwright-results',
  use: { baseURL: 'http://127.0.0.1:3100', viewport: { width: 1280, height: 960 },
    launchOptions: { executablePath: process.env.POLYPHON_CHROMIUM || undefined },
  },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3100', reuseExistingServer: false,
    env: { PORT: '3100', POLYPHON_DATA_DIR: `work/browser-data-${process.pid}` }, timeout: 30000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
