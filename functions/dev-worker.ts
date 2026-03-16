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

  try {
    const payload = JSON.parse(body) as IngestPayload;
    console.log(`[worker] Received job: ${payload.jobId} (${payload.filename})`);
    await handleIngest(payload);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("[worker] Error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`[worker] HTTP server listening on http://localhost:${PORT}`);
  console.log(`[worker] Set INGEST_WORKER_URL=http://localhost:${PORT} when running dev-server for local ingest`);
});
