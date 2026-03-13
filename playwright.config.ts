import { defineConfig, devices } from "@playwright/test";
import * as os from "os";
import * as path from "path";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
const API_PORT = process.env.API_PORT ?? "3003";

// Use temp dirs for e2e so home/navigation tests see empty state (no exercises)
const E2E_EXERCISES_DIR = path.join(os.tmpdir(), "math-drill-e2e-exercises");
const E2E_INTAKE_DIR = path.join(os.tmpdir(), "math-drill-e2e-intake");

export default defineConfig({
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
    command: `concurrently -n ui,api "vite --port ${PORT}" "npx tsx functions/dev-server.ts"`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      EXERCISES_DIR: E2E_EXERCISES_DIR,
      INTAKE_DIR: E2E_INTAKE_DIR,
      API_PORT,
      VITE_API_URL: "",
    },
  },
});
