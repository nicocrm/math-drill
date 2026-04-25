import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
const API_PORT = process.env.API_PORT ?? "3003";

export default defineConfig({
  globalTeardown: "./tests/e2e/global-teardown.ts",
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec tsx tests/e2e/ensure-e2e-storage.ts && pnpm exec concurrently -k "pnpm exec tsx server/api.ts" "pnpm exec tsx server/worker.ts" "sleep 2 && pnpm exec vite --port ${PORT}"`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      ...process.env,
      API_PORT,
      REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    },
  },
});
