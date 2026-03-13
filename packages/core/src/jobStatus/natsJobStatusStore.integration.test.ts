import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { connect } from "nats";
import { NatsJobStatusStore } from "./natsJobStatusStore";
import type { JobState } from "../jobStatus";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";

describe("NatsJobStatusStore integration", () => {
  let store: NatsJobStatusStore | undefined;
  const kvBucket = `ingest-jobs-test-${Date.now()}`;

  beforeAll(async () => {
    try {
      const nc = await connect({ servers: NATS_URL });
      await nc.close();
    } catch (e) {
      throw new Error(
        `NATS not available at ${NATS_URL}. Run 'docker compose up -d nats' first. Original error: ${e}`
      );
    }
    store = new NatsJobStatusStore({
      servers: NATS_URL,
      kvBucket,
      ttlSeconds: 60,
    });
  });

  afterAll(async () => {
    if (store) await store.close();
  });

  it("returns undefined for missing job", async () => {
    const result = await store!.get("nonexistent-job-id");
    expect(result).toBeUndefined();
  });

  it("round-trips job state via set and get", async () => {
    const jobId = "job-roundtrip-1";
    const state: JobState = {
      status: "processing",
      progress: 50,
      step: "validating",
    };
    await store!.set(jobId, state);
    const result = await store!.get(jobId);
    expect(result).toEqual(state);
  });

  it("updateProgress creates new entry when key does not exist", async () => {
    const jobId = "job-update-new-1";
    await store!.updateProgress(jobId, "saving");
    const result = await store!.get(jobId);
    expect(result).toEqual({
      status: "processing",
      step: "saving",
      progress: 10,
    });
  });

  it("updateProgress merges with existing state", async () => {
    const jobId = "job-update-merge-1";
    await store!.set(jobId, {
      status: "processing",
      progress: 10,
      step: "saving",
      exerciseId: "ex-123",
    });
    await store!.updateProgress(jobId, "extracting", { questionCount: 5 });
    const result = await store!.get(jobId);
    expect(result).toEqual({
      status: "processing",
      step: "extracting",
      progress: 40,
      exerciseId: "ex-123",
      questionCount: 5,
    });
  });

  it("updateProgress to done sets status done", async () => {
    const jobId = "job-done-1";
    await store!.set(jobId, { status: "processing", step: "saving_exercise" });
    await store!.updateProgress(jobId, "done", { exerciseId: "ex-final" });
    const result = await store!.get(jobId);
    expect(result).toEqual({
      status: "done",
      step: "done",
      progress: 100,
      exerciseId: "ex-final",
    });
  });

  it("close drains connection without throwing", async () => {
    const store2 = new NatsJobStatusStore({
      servers: NATS_URL,
      kvBucket: `ingest-jobs-test-close-${Date.now()}`,
    });
    await store2.set("job-close-1", { status: "processing" });
    await expect(store2.close()).resolves.toBeUndefined();
  });
});
