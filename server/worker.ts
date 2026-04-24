import "dotenv/config";
import "./e2eEnv.js";
import { Worker } from "bullmq";
import { handleIngest } from "@math-drill/core/ingest/handleIngest";
import { connection } from "./queue.js";

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);

const worker = new Worker("ingest", async (job) => handleIngest(job.data), {
  connection,
  concurrency,
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
});

const shutdown = async (signal: string) => {
  console.log(`[worker] received ${signal}, closing worker (drains in-flight jobs)…`);
  try {
    await worker.close();
    await connection.quit();
  } catch (e) {
    console.error("[worker] shutdown error:", e);
  }
  process.exit(0);
};

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    void shutdown(sig);
  });
}

console.log(
  `[worker] listening on queue "ingest" (concurrency=${concurrency}, redis=${process.env.REDIS_URL ?? "?"})`
);
