import { connect } from "nats";
import { generateExercisesFromPdf } from "@math-drill/core/generateExercisesFromPdf";
import { getExerciseStorage, getFileStorage, getJobStatusStore } from "./lib/env";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";

interface IngestPayload {
  jobId: string;
  exerciseId: string;
  s3Key: string;
  filename: string;
  userId: string;
}

async function handleIngest(payload: IngestPayload): Promise<void> {
  const { jobId, exerciseId, s3Key, filename, userId } = payload;
  const jobStore = getJobStatusStore();
  const fileStorage = getFileStorage();
  const exerciseStorage = getExerciseStorage();

  try {
    await jobStore.updateProgress(jobId, "extracting");
    const pdfBuffer = await fileStorage.download(s3Key);
    const pdfBase64 = pdfBuffer.toString("base64");

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

    console.log(`[worker] Job ${jobId} completed: ${exercise.questions.length} questions`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[worker] Job failed:", { jobId, filename, error });
    await jobStore.set(jobId, { status: "error", error, progress: 0 });
  }
}

async function main() {
  console.log(`[worker] Connecting to NATS at ${NATS_URL}...`);
  const nc = await connect({ servers: NATS_URL });
  console.log("[worker] Connected. Subscribing to ingest.jobs...");

  const sub = nc.subscribe("ingest.jobs");
  for await (const msg of sub) {
    const payload = JSON.parse(new TextDecoder().decode(msg.data)) as IngestPayload;
    console.log(`[worker] Received job: ${payload.jobId} (${payload.filename})`);
    await handleIngest(payload);
  }
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
