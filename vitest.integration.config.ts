import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
    env: {
      REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
