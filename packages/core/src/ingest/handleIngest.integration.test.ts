import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { handleIngest, type IngestPayload } from "./handleIngest";
import { MemoryJobStatusStore } from "../jobStatus/memoryJobStatusStore";
import { LocalExerciseStorage } from "../storage/localExerciseStorage";
import { LocalFileStorage } from "../storage/localFileStorage";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const mockJobStore = new MemoryJobStatusStore();
let testExerciseDir: string;
let testIntakeDir: string;
let mockExerciseStorage: LocalExerciseStorage;
let mockFileStorage: LocalFileStorage;

vi.mock("../env", () => ({
  getJobStatusStore: () => mockJobStore,
  getExerciseStorage: () => mockExerciseStorage,
  getFileStorage: () => mockFileStorage,
}));

vi.mock("../generateExercisesFromPdf", () => ({
  generateExercisesFromPdf: vi.fn().mockResolvedValue({
    id: "will-be-overwritten",
    filename: "test.pdf",
    title: "Test Exercise",
    subject: "Math",
    createdAt: "2025-01-01T00:00:00Z",
    sections: [{ id: "s1", label: "Section 1", maxPoints: 10 }],
    questions: [
      {
        id: "q1",
        type: "numeric",
        section: "s1",
        points: 2,
        prompt: "What is 2+2?",
        answerMath: "4",
        requiresSteps: false,
      },
    ],
  }),
}));

describe("handleIngest", () => {
  beforeAll(async () => {
    testExerciseDir = await mkdtemp(join(tmpdir(), "exercises-"));
    testIntakeDir = await mkdtemp(join(tmpdir(), "intake-"));
    mockExerciseStorage = new LocalExerciseStorage(testExerciseDir);
    mockFileStorage = new LocalFileStorage(testIntakeDir);
  });

  afterAll(async () => {
    await rm(testExerciseDir, { recursive: true, force: true });
    await rm(testIntakeDir, { recursive: true, force: true });
  });

  it("processes an ingest job end-to-end", async () => {
    const s3Key = "test-job-doc.pdf";
    await writeFile(join(testIntakeDir, s3Key), Buffer.from("fake-pdf-content"));

    const payload: IngestPayload = {
      jobId: "job-123",
      exerciseId: "ex-456",
      s3Key,
      filename: "test.pdf",
      userId: "user-789",
    };

    await mockJobStore.set(payload.jobId, { status: "pending", progress: 0 });

    await handleIngest(payload);

    const finalJob = await mockJobStore.get(payload.jobId);
    expect(finalJob).toBeDefined();
    expect(finalJob!.status).toBe("done");
    expect(finalJob!.progress).toBe(100);
    expect(finalJob!.exerciseId).toBe("ex-456");
    expect(finalJob!.questionCount).toBe(1);

    const exercise = await mockExerciseStorage.get("ex-456");
    expect(exercise).toBeDefined();
    expect(exercise!.id).toBe("ex-456");
    expect(exercise!.createdBy).toBe("user-789");
    expect(exercise!.filename).toBe("test.pdf");
    expect(exercise!.questions).toHaveLength(1);
  });

  it("sets error status on failure", async () => {
    const payload: IngestPayload = {
      jobId: "job-fail",
      exerciseId: "ex-fail",
      s3Key: "nonexistent.pdf",
      filename: "missing.pdf",
      userId: "user-1",
    };

    await mockJobStore.set(payload.jobId, { status: "pending", progress: 0 });
    await handleIngest(payload);

    const finalJob = await mockJobStore.get(payload.jobId);
    expect(finalJob).toBeDefined();
    expect(finalJob!.status).toBe("error");
    expect(finalJob!.error).toBeDefined();
  });
});
