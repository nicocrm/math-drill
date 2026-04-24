import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { IngestPayload } from "@math-drill/core/ingest/handleIngest";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. For local dev, run: docker compose up -d (Redis on localhost:6379)."
    );
  }
  return url;
}

const connection = new IORedis(getRedisUrl(), {
  maxRetriesPerRequest: null,
});

export { connection };

export const ingestQueue = new Queue<IngestPayload>("ingest", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  },
});
