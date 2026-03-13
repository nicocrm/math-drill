import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { generateExercisesFromPdf } from "@/lib/generateExercisesFromPdf";
import { saveExercise } from "@/lib/exerciseStore";
import {
  getJob,
  setJob,
  updateProgress,
} from "@/lib/ingestJobs";

const INTAKE_DIR =
  process.env.INTAKE_DIR ?? path.join(process.cwd(), "intake");

const PDF_MIME = "application/pdf";

async function runIngestJob(
  jobId: string,
  exerciseId: string,
  pdfPath: string,
  filename: string
): Promise<void> {
  try {
    updateProgress(jobId, "extracting");
    const pdfBuffer = await readFile(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");

    const exercise = await generateExercisesFromPdf(pdfBase64, filename);
    updateProgress(jobId, "validating");

    exercise.id = exerciseId;
    exercise.filename = filename;
    exercise.createdAt = new Date().toISOString();

    updateProgress(jobId, "saving_exercise");
    await saveExercise(exercise);

    updateProgress(jobId, "done", {
      exerciseId,
      status: "done",
      questionCount: exercise.questions.length,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[ingest] job failed", {
      jobId,
      filename,
      error,
      stack: err instanceof Error ? err.stack : undefined,
    });
    setJob(jobId, {
      status: "error",
      error,
      progress: 0,
    });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file field" },
        { status: 400 }
      );
    }

    if (file.type !== PDF_MIME) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    const exerciseId = uuidv4();
    const filename = file.name || "document.pdf";
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const pdfPath = path.join(INTAKE_DIR, `${jobId}-${safeName}`);

    setJob(jobId, { status: "pending", progress: 0 });

    await mkdir(INTAKE_DIR, { recursive: true });
    updateProgress(jobId, "saving");

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(pdfPath, buffer);

    runIngestJob(jobId, exerciseId, pdfPath, filename).catch(() => {});

    return NextResponse.json({ jobId });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
