import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const API_PORT = process.env.API_PORT ?? "3001";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": `http://localhost:${API_PORT}`,
    },
  },
  build: {
    outDir: "dist/frontend",
  },
});
