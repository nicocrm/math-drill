import { v4 as uuidv4 } from "uuid";
import { connect, credsAuthenticator } from "nats";
import { verifyAuth, requireAuth, HttpError } from "@math-drill/core/auth";
import { getFileStorage, getJobStatusStore } from "../lib/env";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { jsonResponse } from "../lib/scaleway";

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
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

    // Publish NATS message to trigger ingest worker
    if (process.env.NATS_URL) {
      const natsOpts = process.env.NATS_CREDS
        ? { authenticator: credsAuthenticator(new TextEncoder().encode(process.env.NATS_CREDS)) }
        : {};
      const nc = await connect({ servers: process.env.NATS_URL, ...natsOpts });
      const payload = JSON.stringify({
        jobId,
        exerciseId,
        s3Key,
        filename,
        userId: auth.userId,
      });
      nc.publish("ingest.jobs", new TextEncoder().encode(payload));
      await nc.flush();
      await nc.close();
    }

    return jsonResponse(200, { jobId });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.statusCode, { error: err.message });
    }
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse(500, { error });
  }
}
