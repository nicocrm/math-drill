import Anthropic from "@anthropic-ai/sdk";
import type { ExerciseSet } from "@/types/exercise";
import { SYSTEM_PROMPT, parseAndValidateExerciseSet } from "./prompts";

export async function extractExercisesAnthropic(
  pdfBase64: string,
  filename: string
): Promise<ExerciseSet> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
            title: filename,
          },
          {
            type: "text",
            text: `Extract the exercise set from this PDF ("${filename}") and return a single JSON object. No markdown, no code block wrapper—just the raw JSON.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic did not return text content");
  }

  return parseAndValidateExerciseSet(textBlock.text);
}
