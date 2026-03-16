import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { handleIngest, type IngestPayload } from "./ingest-worker/handler";

const PORT = parseInt(process.env.INGEST_WORKER_PORT ?? "3002", 10);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== "POST" || req.url !== "/") {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk.toString();
  }

  let payload: IngestPayload;
  try {
    payload = JSON.parse(body) as IngestPayload;
  } catch (err) {
    console.error("[worker] Invalid JSON:", err);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  console.log(`[worker] Accepted job ${payload.jobId} (${payload.filename}), processing in background`);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));

  void handleIngest(payload).catch((err) => {
    console.error("[worker] Error:", err);
  });
});

server.listen(PORT, () => {
  console.log(`[worker] HTTP server listening on http://localhost:${PORT}`);
  console.log(`[worker] Set INGEST_WORKER_URL=http://localhost:${PORT} when running dev-server for local ingest`);
});
