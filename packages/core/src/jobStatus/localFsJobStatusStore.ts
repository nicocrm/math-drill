import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { JobState, IngestStep, JobStatusStore } from "../jobStatus";
import { STEP_PROGRESS } from "../jobStatus";

export interface LocalFsJobStatusStoreOptions {
  dir?: string;
}

/**
 * Local filesystem job status (shared by API and worker on one machine in dev
 * when STORAGE is not s3). Production with STORAGE=s3 uses S3JobStatusStore.
 */
export class LocalFsJobStatusStore implements JobStatusStore {
  private dir: string;

  constructor(opts: LocalFsJobStatusStoreOptions = {}) {
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
