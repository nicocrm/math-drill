import type { ExerciseSet } from "@/types/exercise";
import { extractExercisesAnthropic } from "./extraction/anthropicProvider";
import { extractExercisesOpenAI } from "./extraction/openaiProvider";

export type ExtractionProvider = "anthropic" | "openai";

function getProvider(): ExtractionProvider {
  const env = process.env.EXTRACTION_PROVIDER?.toLowerCase();
  if (env === "openai") return "openai";
  if (env === "anthropic") return "anthropic";
  return "anthropic";
}

export async function extractExercises(
  pdfBase64: string,
  filename: string
): Promise<ExerciseSet> {
  const provider = getProvider();

  if (provider === "openai") {
    return extractExercisesOpenAI(pdfBase64, filename);
  }

  return extractExercisesAnthropic(pdfBase64, filename);
}
