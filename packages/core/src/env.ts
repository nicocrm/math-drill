import { S3ExerciseStorage } from "./storage/s3ExerciseStorage";
import { S3FileStorage } from "./storage/s3FileStorage";
import { LocalExerciseStorage } from "./storage/localExerciseStorage";
import { LocalFileStorage } from "./storage/localFileStorage";
import { S3JobStatusStore } from "./jobStatus/s3JobStatusStore";
import { LocalFsJobStatusStore } from "./jobStatus/localFsJobStatusStore";
import type { ExerciseStorage, FileStorage } from "./storage";
import type { JobStatusStore } from "./jobStatus";

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

  if (process.env.STORAGE === "s3") {
    jobStatusStore = new S3JobStatusStore({
      bucket: process.env.S3_BUCKET!,
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      prefix: "status",
    });
  } else {
    jobStatusStore = new LocalFsJobStatusStore();
  }
  return jobStatusStore;
}
