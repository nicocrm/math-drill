import type { JobState, IngestStep, JobStatusStore } from "../jobStatus";
import { STEP_PROGRESS } from "../jobStatus";

export class MemoryJobStatusStore implements JobStatusStore {
  private jobs = new Map<string, JobState>();

  async get(jobId: string): Promise<JobState | undefined> {
    return this.jobs.get(jobId);
  }

  async set(jobId: string, state: JobState): Promise<void> {
    this.jobs.set(jobId, state);
  }

  async updateProgress(jobId: string, step: IngestStep, extra?: Partial<JobState>): Promise<void> {
    const current = this.jobs.get(jobId) ?? { status: "processing" as const };
    const progress = STEP_PROGRESS[step];
    this.jobs.set(jobId, {
      ...current,
      status: step === "done" ? "done" : "processing",
      step,
      progress,
      ...extra,
    });
  }
}
