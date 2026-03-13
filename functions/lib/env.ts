import { S3ExerciseStorage } from "@math-drill/core/storage/s3ExerciseStorage";
import { S3FileStorage } from "@math-drill/core/storage/s3FileStorage";
import { LocalExerciseStorage } from "@math-drill/core/storage/localExerciseStorage";
import { LocalFileStorage } from "@math-drill/core/storage/localFileStorage";
import { NatsJobStatusStore } from "@math-drill/core/jobStatus/natsJobStatusStore";
import { MemoryJobStatusStore } from "@math-drill/core/jobStatus/memoryJobStatusStore";
import type { ExerciseStorage, FileStorage } from "@math-drill/core";
import type { JobStatusStore } from "@math-drill/core";

let exerciseStorage: ExerciseStorage | null = null;
let fileStorage: FileStorage | null = null;
let jobStatusStore: JobStatusStore | null = null;

export function getExerciseStorage(): ExerciseStorage {
  if (exerciseStorage) return exerciseStorage;

  if (process.env.STORAGE === "s3") {
    exerciseStorage = new S3ExerciseStorage({
      bucket: process.env.S3_BUCKET!,
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
    });
  } else {
    exerciseStorage = new LocalExerciseStorage();
  }
  return exerciseStorage;
}

export function getFileStorage(): FileStorage {
  if (fileStorage) return fileStorage;

  if (process.env.STORAGE === "s3") {
    fileStorage = new S3FileStorage({
      bucket: process.env.S3_BUCKET!,
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      prefix: "intake",
    });
  } else {
    fileStorage = new LocalFileStorage();
  }
  return fileStorage;
}

export function getJobStatusStore(): JobStatusStore {
  if (jobStatusStore) return jobStatusStore;

  if (process.env.NATS_URL) {
    jobStatusStore = new NatsJobStatusStore({
      servers: process.env.NATS_URL,
    });
  } else {
    jobStatusStore = new MemoryJobStatusStore();
  }
  return jobStatusStore;
}
