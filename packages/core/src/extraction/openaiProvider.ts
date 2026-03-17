import OpenAI from "openai";
import type { ExerciseSet } from "../types/exercise";
import { SYSTEM_PROMPT, parseAndValidateExerciseSet } from "./prompts";
import { verifyExplanations } from "./verifyExplanations";

const OPENAI_MODEL = "gpt-4o";

/**
 * JSON Schema for structured output.
 * All object levels have additionalProperties: false and all properties are required
 * (nullable fields use anyOf with null) as mandated by OpenAI strict mode.
 *
 * The top-level `error` / `message` fields let the model signal that the PDF is not
 * a math exercise without violating the schema.
 */
const EXERCISE_SET_JSON_SCHEMA = {
  type: "object",
  properties: {
    error: { anyOf: [{ type: "string" }, { type: "null" }] },
    message: { anyOf: [{ type: "string" }, { type: "null" }] },
    id: { type: "string" },
    filename: { type: "string" },
    title: { type: "string" },
    subject: { type: "string" },
    createdAt: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          maxPoints: { type: "number" },
        },
        required: ["id", "label", "maxPoints"],
        additionalProperties: false,
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: ["multiple_choice", "true_false", "numeric", "expression", "open"],
          },
          section: { type: "string" },
          points: { type: "number" },
          prompt: { type: "string" },
          choices: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    latex: { type: "string" },
                  },
                  required: ["id", "latex"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          answerMath: {
            anyOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
              { type: "null" },
            ],
          },
          answerLatex: { anyOf: [{ type: "string" }, { type: "null" }] },
          requiresSteps: { type: "boolean" },
          requiresExample: { anyOf: [{ type: "boolean" }, { type: "null" }] },
          hint: { anyOf: [{ type: "string" }, { type: "null" }] },
          explanation: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: [
          "id",
          "type",
          "section",
          "points",
          "prompt",
          "choices",
          "answerMath",
          "answerLatex",
          "requiresSteps",
          "requiresExample",
          "hint",
          "explanation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "error",
    "message",
    "id",
    "filename",
    "title",
    "subject",
    "createdAt",
    "sections",
    "questions",
  ],
  additionalProperties: false,
} as const;

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
    text: {
      format: {
        type: "json_schema",
        name: "exercise_set",
        strict: true,
        schema: EXERCISE_SET_JSON_SCHEMA,
      },
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

  const outputText = (response as { output_text?: string }).output_text;
  if (!outputText || typeof outputText !== "string") {
    throw new Error("OpenAI did not return text content");
  }

  const exerciseSet = parseAndValidateExerciseSet(outputText);
  return verifyExplanations(exerciseSet);
}
