import { connect, credsAuthenticator, type NatsConnection, type KV } from "nats";
import type { JobState, IngestStep, JobStatusStore } from "../jobStatus";
import { STEP_PROGRESS } from "../jobStatus";

export interface NatsJobStatusStoreOptions {
  servers: string;
  creds?: string;
  kvBucket?: string;
  ttlSeconds?: number;
}

export class NatsJobStatusStore implements JobStatusStore {
  private nc: NatsConnection | null = null;
  private kv: KV | null = null;
  private opts: NatsJobStatusStoreOptions;
  private kvBucket: string;
  private ttlMs: number;

  constructor(opts: NatsJobStatusStoreOptions) {
    this.opts = opts;
    this.kvBucket = opts.kvBucket ?? "ingest-jobs";
    this.ttlMs = (opts.ttlSeconds ?? 3600) * 1000;
  }

  private async ensureKV(): Promise<KV> {
    if (this.kv) return this.kv;
    const auth = this.opts.creds
      ? { authenticator: credsAuthenticator(new TextEncoder().encode(this.opts.creds)) }
      : {};
    this.nc = await connect({ servers: this.opts.servers, ...auth });
    const js = this.nc.jetstream();
    this.kv = await js.views.kv(this.kvBucket, { ttl: this.ttlMs });
    return this.kv;
  }

  async get(jobId: string): Promise<JobState | undefined> {
    const kv = await this.ensureKV();
    const entry = await kv.get(jobId);
    if (!entry?.value) return undefined;
    return JSON.parse(new TextDecoder().decode(entry.value)) as JobState;
  }

  async set(jobId: string, state: JobState): Promise<void> {
    const kv = await this.ensureKV();
    await kv.put(jobId, JSON.stringify(state));
  }

  async updateProgress(jobId: string, step: IngestStep, extra?: Partial<JobState>): Promise<void> {
    const kv = await this.ensureKV();
    const entry = await kv.get(jobId);
    const current: JobState = entry?.value
      ? JSON.parse(new TextDecoder().decode(entry.value))
      : { status: "processing" };

    const progress = STEP_PROGRESS[step];
    const updated: JobState = {
      ...current,
      status: step === "done" ? "done" : "processing",
      step,
      progress,
      ...extra,
    };
    await kv.put(jobId, JSON.stringify(updated));
  }

  async close(): Promise<void> {
    if (this.nc) {
      await this.nc.drain();
      this.nc = null;
      this.kv = null;
    }
  }
}
