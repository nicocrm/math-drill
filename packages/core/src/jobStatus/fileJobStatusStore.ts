import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { JobState, IngestStep, JobStatusStore } from "../jobStatus";
import { STEP_PROGRESS } from "../jobStatus";

export interface FileJobStatusStoreOptions {
  dir?: string;
}

/**
 * File-based job status store for local dev.
 * Writes status/{jobId}.json so dev-server and dev-worker (separate processes)
 * share the same status via the filesystem.
 */
export class FileJobStatusStore implements JobStatusStore {
  private dir: string;

  constructor(opts: FileJobStatusStoreOptions = {}) {
    this.dir =
      opts.dir ??
      process.env.STATUS_DIR ??
      path.join(process.cwd(), "status");
  }

  private filePath(jobId: string): string {
    return path.join(this.dir, `${jobId}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async get(jobId: string): Promise<JobState | undefined> {
    const filePath = this.filePath(jobId);
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as JobState;
    } catch {
      return undefined;
    }
  }

  async set(jobId: string, state: JobState): Promise<void> {
    await this.ensureDir();
    const filePath = this.filePath(jobId);
    await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
  }

  async updateProgress(
    jobId: string,
    step: IngestStep,
    extra?: Partial<JobState>
  ): Promise<void> {
    const current = (await this.get(jobId)) ?? { status: "processing" as const };
    const progress = STEP_PROGRESS[step];
    const updated: JobState = {
      ...current,
      status: step === "done" ? "done" : "processing",
      step,
      progress,
      ...extra,
    };
    await this.set(jobId, updated);
  }
}
