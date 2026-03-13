import { MemoryJobStatusStore } from "@math-drill/core/jobStatus/memoryJobStatusStore";
import type { JobState, IngestStep } from "@math-drill/core";

export type { JobStatus, IngestStep, JobState } from "@math-drill/core";

const store = new MemoryJobStatusStore();

export function getJob(id: string): Promise<JobState | undefined> {
  return store.get(id);
}

export function setJob(id: string, state: JobState): Promise<void> {
  return store.set(id, state);
}

export function updateProgress(
  id: string,
  step: IngestStep,
  extra?: Partial<JobState>
): Promise<void> {
  return store.updateProgress(id, step, extra);
}
