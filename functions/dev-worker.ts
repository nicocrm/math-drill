import { connect } from "nats";
import { handleIngest, type IngestPayload } from "./ingest-worker/handler";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";

async function main() {
  console.log(`[worker] Connecting to NATS at ${NATS_URL}...`);
  const nc = await connect({ servers: NATS_URL });
  console.log("[worker] Connected. Subscribing to ingest.jobs...");

  const sub = nc.subscribe("ingest.jobs");
  for await (const msg of sub) {
    const payload = JSON.parse(new TextDecoder().decode(msg.data)) as IngestPayload;
    console.log(`[worker] Received job: ${payload.jobId} (${payload.filename})`);
    await handleIngest(payload);
  }
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
