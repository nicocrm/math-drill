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
  error?: string;
}

const jobs = new Map<string, JobState>();

const STEP_PROGRESS: Record<IngestStep, number> = {
  saving: 10,
  extracting: 40,
  validating: 70,
  saving_exercise: 90,
  done: 100,
};

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function setJob(id: string, state: JobState): void {
  jobs.set(id, state);
}

export function updateProgress(
  id: string,
  step: IngestStep,
  extra?: Partial<JobState>
): void {
  const current = jobs.get(id) ?? { status: "processing" as const };
  const progress = STEP_PROGRESS[step];
  jobs.set(id, {
    ...current,
    status: step === "done" ? "done" : "processing",
    step,
    progress,
    ...extra,
  });
}
