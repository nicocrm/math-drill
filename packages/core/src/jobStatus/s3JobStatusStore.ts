import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { JobState, IngestStep, JobStatusStore } from "../jobStatus";
import { STEP_PROGRESS } from "../jobStatus";

export interface S3JobStatusStoreOptions {
  bucket: string;
  endpoint?: string;
  region?: string;
  prefix?: string;
}

export class S3JobStatusStore implements JobStatusStore {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(opts: S3JobStatusStoreOptions) {
    this.bucket = opts.bucket;
    this.prefix = opts.prefix ?? "status";
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region ?? "fr-par",
      forcePathStyle: true,
    });
  }

  private key(jobId: string): string {
    return `${this.prefix}/${jobId}.json`;
  }

  async get(jobId: string): Promise<JobState | undefined> {
    try {
      const resp = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.key(jobId),
        })
      );
      const body = await resp.Body?.transformToString();
      if (!body) return undefined;
      return JSON.parse(body) as JobState;
    } catch (err: unknown) {
      const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
      if (
        e?.name === "NoSuchKey" ||
        e?.Code === "NoSuchKey" ||
        e?.$metadata?.httpStatusCode === 404
      ) {
        return undefined;
      }
      throw err;
    }
  }

  async set(jobId: string, state: JobState): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(jobId),
        Body: JSON.stringify(state),
        ContentType: "application/json",
      })
    );
  }

  async updateProgress(jobId: string, step: IngestStep, extra?: Partial<JobState>): Promise<void> {
    const current = await this.get(jobId) ?? { status: "processing" as const };
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
