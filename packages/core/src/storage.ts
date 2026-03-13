import type { ExerciseSet } from "./types/exercise";

export interface ExerciseStorage {
  list(): Promise<ExerciseSet[]>;
  listByUser(userId: string): Promise<ExerciseSet[]>;
  get(id: string): Promise<ExerciseSet | null>;
  save(exercise: ExerciseSet): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface FileStorage {
  upload(key: string, data: Buffer): Promise<void>;
  download(key: string): Promise<Buffer>;
}
