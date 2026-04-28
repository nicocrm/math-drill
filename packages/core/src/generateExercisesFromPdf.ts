import type { ExerciseSet } from "./types/exercise";
import { generateExercisesFromPdfOpenAI } from "./extraction/openaiProvider";

export type ExtractionProvider = "openai";

export async function generateExercisesFromPdf(
  pdfBase64: string,
  filename: string,
  documentId?: string
): Promise<ExerciseSet> {
  return generateExercisesFromPdfOpenAI(pdfBase64, filename, documentId);
}
