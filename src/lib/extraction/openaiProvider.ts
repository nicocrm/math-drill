import OpenAI from "openai";
import type { ExerciseSet } from "@/types/exercise";
import { SYSTEM_PROMPT, parseAndValidateExerciseSet } from "./prompts";
import { verifyExplanations } from "./verifyExplanations";

const OPENAI_MODEL = "gpt-4o";

export async function generateExercisesFromPdfOpenAI(
  pdfBase64: string,
  filename: string
): Promise<ExerciseSet> {
  const client = new OpenAI();

  const fileData = `data:application/pdf;base64,${pdfBase64}`;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    max_output_tokens: 8192,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            file_data: fileData,
            filename,
          },
          {
            type: "input_text",
            text: `Generate a NEW exercise set based on this PDF ("${filename}"). Use it as a reference for topic, difficulty, format, and style—but create fresh questions with different numbers and wording. Return a single JSON object. No markdown, no code block wrapper—just the raw JSON.`,
          },
        ],
      },
    ],
  });

  const outputText = (response as { output_text?: string }).output_text;
  if (!outputText || typeof outputText !== "string") {
    throw new Error("OpenAI did not return text content");
  }

  const exerciseSet = parseAndValidateExerciseSet(outputText);
  return verifyExplanations(exerciseSet);
}
