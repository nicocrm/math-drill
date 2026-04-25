import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ExerciseSet } from "../types/exercise";
import { llmResponseSchema } from "../exerciseSchema";
import { SYSTEM_PROMPT, parseAndValidateExerciseSet } from "./prompts";
import { verifyExplanations } from "./verifyExplanations";

const OPENAI_MODEL = "gpt-5.4-mini";

export async function generateExercisesFromPdfOpenAI(
  pdfBase64: string,
  filename: string
): Promise<ExerciseSet> {
  const client = new OpenAI();

  const fileData = `data:application/pdf;base64,${pdfBase64}`;

  const response = await client.responses.parse({
    model: OPENAI_MODEL,
    max_output_tokens: 8192,
    instructions: SYSTEM_PROMPT,
    text: {
      format: zodTextFormat(llmResponseSchema, "exercise_set"),
    },
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
            text: `Generate a NEW exercise set based on this PDF ("${filename}"). Use it as a reference for topic, difficulty, format, and style—but create fresh questions with different numbers and wording.`,
          },
        ],
      },
    ],
  });

  const outputText = response.output_text;
  if (!outputText || typeof outputText !== "string") {
    throw new Error("OpenAI did not return text content");
  }

  const exerciseSet = parseAndValidateExerciseSet(outputText);
  return verifyExplanations(exerciseSet);
}
