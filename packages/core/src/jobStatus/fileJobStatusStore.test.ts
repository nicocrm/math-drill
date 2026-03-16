import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";
import { FileJobStatusStore } from "./fileJobStatusStore";
import type { JobState } from "../jobStatus";

describe("FileJobStatusStore", () => {
  let store: FileJobStatusStore;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "job-status-"));
    store = new FileJobStatusStore({ dir: tmpDir });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns undefined for missing job", async () => {
    const result = await store.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("round-trips job state via set and get", async () => {
    const jobId = "job-1";
    const state: JobState = {
      status: "processing",
      progress: 50,
      step: "validating",
    };

    await store.set(jobId, state);
    const got = await store.get(jobId);
    expect(got).toEqual(state);
  });

  it("updateProgress merges with current state", async () => {
    const jobId = "job-new";
    await store.set(jobId, { status: "pending", progress: 0 });
    await store.updateProgress(jobId, "saving");

    const got = await store.get(jobId);
    expect(got).toMatchObject({
      status: "processing",
      progress: 10,
      step: "saving",
    });
  });

  it("updateProgress creates entry when missing", async () => {
    await store.updateProgress("job-new", "saving");

    const got = await store.get("job-new");
    expect(got).toMatchObject({
      status: "processing",
      progress: 10,
      step: "saving",
    });
  });
});
