import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "node:net";
import type { Queue } from "bullmq";
import type { IngestPayload } from "@math-drill/core/ingest/handleIngest";
import { createApp } from "./app.js";

const upload = vi.fn().mockResolvedValue(undefined);
const jobSet = vi.fn().mockResolvedValue(undefined);
const jobUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock("@math-drill/core/env", () => ({
  getExerciseStorage: () => ({}),
  getFileStorage: () => ({ upload }),
  getJobStatusStore: () => ({
    set: jobSet,
    updateProgress: jobUpdate,
    get: vi.fn(),
  }),
}));

vi.mock("@math-drill/core/auth", () => ({
  verifyAuth: () => Promise.resolve({ userId: "auth-user-1" }),
  requireAuth: () => {},
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

describe("POST /api/ingest", () => {
  let add: ReturnType<typeof vi.fn>;
  let server: Server;
  let port: number;

  beforeEach(() => {
    add = vi.fn().mockResolvedValue(undefined);
    const ingestQueue = { add } as unknown as Queue<IngestPayload>;
    const app = createApp({ serveStatic: false, ingestQueue });
    server = createServer(app);
    return new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    }).then(() => {
      const addr = server.address() as AddressInfo;
      port = addr.port;
    });
  });

  afterEach(async () => {
    add.mockReset();
    upload.mockClear();
    jobSet.mockClear();
    jobUpdate.mockClear();
    await new Promise<void>((resolve, reject) => {
      server.close((e) => (e ? reject(e) : resolve()));
    });
  });

  it("enqueues ingest job with userId and payload shape", async () => {
    const pdfB64 = Buffer.from("%PDF-1.1.").toString("base64");
    const res = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdf: pdfB64, filename: "quiz.pdf" }),
    });
    expect(res.status).toBe(200);
    const out = (await res.json()) as { jobId: string };
    expect(out.jobId).toBeDefined();
    expect(add).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = add.mock.calls[0] as [
      string,
      IngestPayload,
      { attempts: number; backoff: { type: string; delay: number } },
    ];
    expect(name).toBe("ingest");
    expect(opts.attempts).toBe(2);
    expect(opts.backoff).toEqual({ type: "exponential", delay: 5000 });
    expect(payload.userId).toBe("auth-user-1");
    expect(payload.filename).toBe("quiz.pdf");
    expect(payload.s3Key).toBe(`${out.jobId}-quiz.pdf`);
  });
});
