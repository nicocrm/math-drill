import "dotenv/config";
import "./e2eEnv.js";
import { createApp } from "./app.js";
import { ingestQueue } from "./queue.js";

/** Vite dev serves the SPA; production Node serves `dist/frontend` from the same process. */
const serveStatic = process.env.NODE_ENV === "production";
const app = createApp({ serveStatic, ingestQueue });
// Prefer API_PORT to match Vite's proxy; Coolify can set PORT.
const port = parseInt(
  process.env.API_PORT ?? process.env.PORT ?? "3001",
  10
);
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
