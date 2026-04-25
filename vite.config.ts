import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const API_PORT = process.env.API_PORT ?? process.env.PORT ?? "3001";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${API_PORT}`,
    },
  },
  build: {
    outDir: "dist/frontend",
  },
});
