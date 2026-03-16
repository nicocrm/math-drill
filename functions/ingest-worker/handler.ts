import { generateExercisesFromPdf } from "@math-drill/core/generateExercisesFromPdf";
import { getExerciseStorage, getFileStorage, getJobStatusStore } from "../lib/env";

export interface IngestPayload {
  jobId: string;
  exerciseId: string;
  s3Key: string;
  filename: string;
  userId: string;
}

/**
 * Core ingest logic — shared between the Scaleway SQS-triggered function
 * and the local dev-worker (HTTP).
 */
export async function handleIngest(payload: IngestPayload): Promise<void> {
  const { jobId, exerciseId, s3Key, filename, userId } = payload;
  const jobStore = getJobStatusStore();
  const fileStorage = getFileStorage();
  const exerciseStorage = getExerciseStorage();

  console.log(`[ingest-worker] Starting job ${jobId}: file=${filename}, s3Key=${s3Key}`);

  try {
    await jobStore.updateProgress(jobId, "extracting");
    const pdfBuffer = await fileStorage.download(s3Key);
    const pdfBase64 = pdfBuffer.toString("base64");

    const provider = process.env.EXTRACTION_PROVIDER?.toLowerCase() ?? "anthropic";
    console.log(`[ingest-worker] Job ${jobId}: calling extraction provider=${provider}`);

    const exercise = await generateExercisesFromPdf(pdfBase64, filename);
    await jobStore.updateProgress(jobId, "validating");

    exercise.id = exerciseId;
    exercise.filename = filename;
    exercise.createdAt = new Date().toISOString();
    exercise.createdBy = userId;

    await jobStore.updateProgress(jobId, "saving_exercise");
    await exerciseStorage.save(exercise);

    await jobStore.updateProgress(jobId, "done", {
      exerciseId,
      status: "done",
      questionCount: exercise.questions.length,
    });

    console.log(`[ingest-worker] Job ${jobId} completed: ${exercise.questions.length} questions`);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const error = e.message;
    console.error("[ingest-worker] Job failed:", {
      jobId,
      filename,
      error,
      name: e.name,
      cause: e.cause,
      stack: e.stack,
    });
    await jobStore.set(jobId, { status: "error", error, progress: 0 });
  }
}

/**
 * Scaleway SQS-triggered function handler.
 * Scaleway delivers SQS messages to the function. The event may be:
 * - { body: string } — raw message body (simple format)
 * - { Records: [{ body: string }] } — full SQS event format
 */
export async function handle(
  event: { body?: string; Records?: Array<{ body: string }> },
  _context: unknown
): Promise<{ statusCode: number; body: string }> {
  const body =
    event.Records?.[0]?.body ?? event.body ?? "{}";
  const payload = JSON.parse(body) as IngestPayload;
  console.log(`[ingest-worker] Received job: ${payload.jobId} (${payload.filename})`);
  await handleIngest(payload);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
