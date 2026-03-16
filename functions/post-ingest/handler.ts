import { v4 as uuidv4 } from "uuid";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { verifyAuth, requireAuth, HttpError } from "@math-drill/core/auth";
import { getFileStorage, getJobStatusStore } from "../lib/env";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { jsonResponse, handleCorsPreflightMaybe } from "../lib/scaleway";

async function triggerIngestWorker(payload: {
  jobId: string;
  exerciseId: string;
  s3Key: string;
  filename: string;
  userId: string;
}): Promise<void> {
  const queueUrl = process.env.SQS_QUEUE_URL;
  const workerUrl = process.env.INGEST_WORKER_URL;

  if (queueUrl) {
    const endpoint = process.env.SQS_ENDPOINT ?? new URL(queueUrl).origin;
    const client = new SQSClient({
      endpoint,
      region: process.env.SQS_REGION ?? "fr-par",
      credentials:
        process.env.SQS_ACCESS_KEY_ID && process.env.SQS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.SQS_ACCESS_KEY_ID,
              secretAccessKey: process.env.SQS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload),
      })
    );
    console.log(`[post-ingest] Sent to SQS: jobId=${payload.jobId}`);
  } else if (workerUrl) {
    console.log(`[post-ingest] Fetching worker at ${workerUrl} for jobId=${payload.jobId}`);
    try {
      const resp = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error(`[post-ingest] Worker returned ${resp.status}: ${text}`);
        throw new Error(`Worker returned ${resp.status}: ${text}`);
      }
      console.log(`[post-ingest] Triggered worker via HTTP: jobId=${payload.jobId}`);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error("[post-ingest] Fetch to worker failed:", {
        url: workerUrl,
        jobId: payload.jobId,
        message: e.message,
        cause: e.cause,
        stack: e.stack,
      });
      throw err;
    }
  } else {
    console.warn("[post-ingest] SQS_QUEUE_URL and INGEST_WORKER_URL not set — ingest worker will not run");
  }
}

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
  const preflight = handleCorsPreflightMaybe(event);
  if (preflight) return preflight;

  const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
  const req = new Request("http://localhost", {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  try {
    const auth = await verifyAuth(req);
    requireAuth(auth);

    // Parse multipart or base64-encoded body
    const contentType = event.headers?.["content-type"] ?? event.headers?.["Content-Type"] ?? "";

    if (!contentType.includes("application/pdf") && !contentType.includes("multipart/form-data")) {
      // Accept raw PDF body (base64 encoded by Scaleway) or JSON with base64 field
      if (!event.body) {
        return jsonResponse(400, { error: "Missing request body" });
      }
    }

    let pdfBuffer: Buffer;
    let filename = "document.pdf";

    if (contentType.includes("application/json")) {
      // JSON body: { pdf: "<base64>", filename: "..." }
      const body = JSON.parse(event.body);
      if (!body.pdf) {
        return jsonResponse(400, { error: "Missing pdf field" });
      }
      pdfBuffer = Buffer.from(body.pdf, "base64");
      filename = body.filename ?? filename;
    } else {
      // Raw PDF body (base64 encoded by Scaleway gateway)
      pdfBuffer = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : Buffer.from(event.body);
      filename = event.queryStringParameters?.filename ?? filename;
    }

    const jobId = uuidv4();
    const exerciseId = uuidv4();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `${jobId}-${safeName}`;

    const jobStore = getJobStatusStore();
    await jobStore.set(jobId, { status: "pending", progress: 0 });

    const fileStorage = getFileStorage();
    await jobStore.updateProgress(jobId, "saving");
    await fileStorage.upload(s3Key, pdfBuffer);

    await triggerIngestWorker({
      jobId,
      exerciseId,
      s3Key,
      filename,
      userId: auth.userId,
    });

    return jsonResponse(200, { jobId });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.statusCode, { error: err.message });
    }
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse(500, { error });
  }
}
