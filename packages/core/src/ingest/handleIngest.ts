import { generateExercisesFromPdf } from "../generateExercisesFromPdf";
import { getExerciseStorage, getFileStorage, getJobStatusStore } from "../env";

export interface IngestPayload {
  jobId: string;
  exerciseId: string;
  documentId: string;
  filename: string;
  userId: string;
}

/**
 * Core ingest — shared by the API (enqueue) / worker (process) and tests.
 */
export async function handleIngest(payload: IngestPayload): Promise<void> {
  const { jobId, exerciseId, documentId, filename, userId } = payload;
  const jobStore = getJobStatusStore();
  const fileStorage = getFileStorage();
  const exerciseStorage = getExerciseStorage();

  console.log(`[ingest] Starting job ${jobId}: file=${filename}, documentId=${documentId}`);

  try {
    await jobStore.updateProgress(jobId, "extracting");
    const pdfBuffer = await fileStorage.download(documentId);
    const pdfBase64 = pdfBuffer.toString("base64");

    const provider = process.env.EXTRACTION_PROVIDER?.toLowerCase() ?? "anthropic";
    console.log(`[ingest] Job ${jobId}: calling extraction provider=${provider}`);

    const exercise = await generateExercisesFromPdf(pdfBase64, filename, documentId);
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

    console.log(`[ingest] Job ${jobId} completed: ${exercise.questions.length} questions`);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const error = e.message.startsWith("not_math_exercise: ")
      ? e.message.slice("not_math_exercise: ".length)
      : e.message;
    console.error("[ingest] Job failed:", {
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
