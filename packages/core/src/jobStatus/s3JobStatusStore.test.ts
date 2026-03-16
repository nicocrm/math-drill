import { describe, it, expect, vi, beforeEach } from "vitest";
import { S3JobStatusStore } from "./s3JobStatusStore";
import type { JobState } from "../jobStatus";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = mockSend;
  },
  GetObjectCommand: class {},
  PutObjectCommand: class {},
}));

describe("S3JobStatusStore", () => {
  let store: S3JobStatusStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new S3JobStatusStore({
      bucket: "test-bucket",
      prefix: "status",
    });
  });

  it("returns undefined for missing job", async () => {
    mockSend.mockRejectedValueOnce({ name: "NoSuchKey" });

    const result = await store.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns undefined for 404", async () => {
    mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

    const result = await store.get("missing");
    expect(result).toBeUndefined();
  });

  it("round-trips job state via set and get", async () => {
    const jobId = "job-1";
    const state: JobState = {
      status: "processing",
      progress: 50,
      step: "validating",
    };

    mockSend
      .mockResolvedValueOnce(undefined) // set
      .mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve(JSON.stringify(state)) },
      }); // get

    await store.set(jobId, state);
    const result = await store.get(jobId);

    expect(result).toEqual(state);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("updateProgress creates new entry when key does not exist", async () => {
    const expectedState = {
      status: "processing" as const,
      step: "saving" as const,
      progress: 10,
    };
    mockSend
      .mockRejectedValueOnce({ name: "NoSuchKey" }) // get returns undefined
      .mockResolvedValueOnce(undefined) // set
      .mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve(JSON.stringify(expectedState)) },
      }); // get for assertion

    await store.updateProgress("job-new", "saving");
    const result = await store.get("job-new");

    expect(result).toEqual(expectedState);
  });

  it("updateProgress merges with existing state", async () => {
    const existing: JobState = {
      status: "processing",
      progress: 10,
      step: "saving",
      exerciseId: "ex-123",
    };

    mockSend
      .mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve(JSON.stringify(existing)) },
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        Body: {
          transformToString: () =>
            Promise.resolve(
              JSON.stringify({
                ...existing,
                step: "extracting",
                progress: 40,
                questionCount: 5,
              })
            ),
        },
      });

    await store.updateProgress("job-merge", "extracting", { questionCount: 5 });
    const result = await store.get("job-merge");

    expect(result).toEqual({
      status: "processing",
      step: "extracting",
      progress: 40,
      exerciseId: "ex-123",
      questionCount: 5,
    });
  });

  it("updateProgress to done sets status done", async () => {
    mockSend
      .mockResolvedValueOnce({
        Body: {
          transformToString: () =>
            Promise.resolve(
              JSON.stringify({ status: "processing", step: "saving_exercise" })
            ),
        },
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        Body: {
          transformToString: () =>
            Promise.resolve(
              JSON.stringify({
                status: "done",
                step: "done",
                progress: 100,
                exerciseId: "ex-final",
              })
            ),
        },
      });

    await store.updateProgress("job-done", "done", { exerciseId: "ex-final" });
    const result = await store.get("job-done");

    expect(result).toEqual({
      status: "done",
      step: "done",
      progress: 100,
      exerciseId: "ex-final",
    });
  });
});
