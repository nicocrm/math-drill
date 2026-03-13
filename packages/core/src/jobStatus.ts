export type JobStatus =
  | "pending"
  | "processing"
  | "done"
  | "error";

export type IngestStep =
  | "saving"
  | "extracting"
  | "validating"
  | "saving_exercise"
  | "done";

export interface JobState {
  status: JobStatus;
  progress?: number;
  step?: IngestStep;
  exerciseId?: string;
  questionCount?: number;
  error?: string;
}

export const STEP_PROGRESS: Record<IngestStep, number> = {
  saving: 10,
  extracting: 40,
  validating: 70,
  saving_exercise: 90,
  done: 100,
};

export interface JobStatusStore {
  get(jobId: string): Promise<JobState | undefined>;
  set(jobId: string, state: JobState): Promise<void>;
  updateProgress(jobId: string, step: IngestStep, extra?: Partial<JobState>): Promise<void>;
}
