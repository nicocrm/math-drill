import { randomUUID } from "node:crypto";
import IORedis from "ioredis";
import { Queue, QueueEvents, Worker } from "bullmq";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

describe("BullMQ (real Redis)", () => {
  let connection: IORedis;

  beforeAll(async () => {
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    await connection.ping();
  });

  afterAll(async () => {
    await connection.quit();
  });

  it("respects concurrency: at most 2 active when concurrency=2 and 4 jobs are queued", async () => {
    const name = `conc-${randomUUID()}`;
    const q = new Queue(name, { connection });
    let maxActive = 0;
    let current = 0;
    const w = new Worker(
      name,
      async () => {
        current++;
        maxActive = Math.max(maxActive, current);
        await new Promise((r) => setTimeout(r, 120));
        current--;
      },
      { connection, concurrency: 2 }
    );
    await q.addBulk([0, 1, 2, 3].map((i) => ({ name: "j", data: { i } })));
    for (let i = 0; i < 60; i++) {
      const c = await q.getJobCounts("active", "completed", "failed");
      if ((c.completed ?? 0) + (c.failed ?? 0) === 4) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(maxActive).toBeLessThanOrEqual(2);
    expect((await q.getJobCounts("completed"))?.completed).toBe(4);
    await w.close();
    await q.close();
  });

  it("graceful shutdown: worker.close() without force waits for the in-flight job to finish", async () => {
    const name = `grace-${randomUUID()}`;
    const q = new Queue(name, { connection });
    const done = { ok: false };
    const w = new Worker(
      name,
      async () => {
        await new Promise((r) => setTimeout(r, 200));
        done.ok = true;
      },
      { connection, concurrency: 1 }
    );
    await q.add("one", { x: 1 });
    await new Promise((r) => setTimeout(r, 40));
    const start = Date.now();
    await w.close();
    expect(Date.now() - start).toBeGreaterThanOrEqual(150);
    expect(done.ok).toBe(true);
    await q.close();
  });

  it("persists and retries: a job can run a second time after a transient failure (same job id)", async () => {
    const name = `retry-${randomUUID()}`;
    const q = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed" as const, delay: 20 },
      },
    });
    const events = new QueueEvents(name, { connection });
    let attempts = 0;
    const w = new Worker(
      name,
      async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("transient");
        }
      },
      { connection, concurrency: 1 }
    );
    const job = await q.add("a", { n: 1 });
    try {
      await job.waitUntilFinished(events, 10_000);
      expect(attempts).toBe(2);
      expect((await job.getState()) as string).toBe("completed");
    } finally {
      await w.close();
      await events.close();
      await q.close();
    }
  });
});
