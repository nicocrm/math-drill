import type { ExerciseSet } from "./types/exercise";
import { generateExercisesFromPdfAnthropic } from "./extraction/anthropicProvider";
import { generateExercisesFromPdfOpenAI } from "./extraction/openaiProvider";

export type ExtractionProvider = "anthropic" | "openai";

function getProvider(): ExtractionProvider {
  const env = process.env.EXTRACTION_PROVIDER?.toLowerCase();
  if (env === "openai") return "openai";
  if (env === "anthropic") return "anthropic";
  return "anthropic";
}

export async function generateExercisesFromPdf(
  pdfBase64: string,
  filename: string
): Promise<ExerciseSet> {
  const provider = getProvider();

  if (provider === "openai") {
    return generateExercisesFromPdfOpenAI(pdfBase64, filename);
  }

  return generateExercisesFromPdfAnthropic(pdfBase64, filename);
}
