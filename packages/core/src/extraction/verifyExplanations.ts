import OpenAI from "openai";
import type { ExerciseSet, Question } from "../types/exercise";

function shouldVerify(): boolean {
  const env = process.env.VERIFY_EXPLANATIONS?.toLowerCase();
  if (env === "false" || env === "0") return false;
  return true;
}

interface VerificationItem {
  questionId: string;
  prompt: string;
  answerMath: string | string[] | null;
  answerLatex?: string;
  explanation: string;
}

interface VerificationResult {
  questionId: string;
  valid: boolean;
  issues?: string[];
}

const VERIFICATION_SYSTEM_PROMPT = `You are a math education verifier. For each item, check if the explanation is factual and non-hallucinated.

Criteria:
1. The explanation states only well-established mathematical facts.
2. No numbers, examples, or derivations are invented that don't appear in the question or correct answer.
3. The explanation does not contradict the correct answer.

Return a JSON array with one object per item. Each object must have: "questionId" (string), "valid" (boolean). If valid is false, include "issues" (string array) describing what is wrong.
Return ONLY the JSON array, no markdown or extra text.`;

function buildVerificationPayload(items: VerificationItem[]): string {
  return JSON.stringify(
    items.map(({ questionId, prompt, answerMath, answerLatex, explanation }) => ({
      questionId,
      prompt,
      answerMath,
      answerLatex: answerLatex ?? null,
      explanation,
    }))
  );
}

function parseVerificationResponse(raw: string): VerificationResult[] {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  const toParse = jsonMatch ? jsonMatch[0] : trimmed;
  return JSON.parse(toParse) as VerificationResult[];
}

async function verifyWithOpenAI(items: VerificationItem[]): Promise<VerificationResult[]> {
  const client = new OpenAI();
  const payload = buildVerificationPayload(items);

  const response = await client.responses.create({
    model: "gpt-4o",
    max_output_tokens: 2048,
    instructions: VERIFICATION_SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Verify these explanations:\n\n${payload}\n\nReturn a JSON array of { questionId, valid, issues? } for each item.`,
          },
        ],
      },
    ],
  });

  const outputText = (response as { output_text?: string }).output_text;
  if (!outputText || typeof outputText !== "string") {
    throw new Error("OpenAI did not return text content");
  }

  return parseVerificationResponse(outputText);
}

export async function verifyExplanations(exerciseSet: ExerciseSet): Promise<ExerciseSet> {
  if (!shouldVerify()) {
    return exerciseSet;
  }

  const itemsWithExplanation = exerciseSet.questions.filter(
    (q): q is Question & { explanation: string } =>
      typeof q.explanation === "string" && q.explanation.trim().length > 0
  );

  if (itemsWithExplanation.length === 0) {
    return exerciseSet;
  }

  const items: VerificationItem[] = itemsWithExplanation.map((q) => ({
    questionId: q.id,
    prompt: q.prompt,
    answerMath: q.answerMath,
    answerLatex: q.answerLatex,
    explanation: q.explanation,
  }));

  let results: VerificationResult[];
  try {
    results = await verifyWithOpenAI(items);
  } catch {
    // On API failure: strip all explanations for safety
    return {
      ...exerciseSet,
      questions: exerciseSet.questions.map((q) => {
        const { explanation: _, ...rest } = q;
        return rest;
      }),
    };
  }

  const invalidIds = new Set(
    results.filter((r) => !r.valid).map((r) => r.questionId)
  );

  return {
    ...exerciseSet,
    questions: exerciseSet.questions.map((q) => {
      if (q.explanation && invalidIds.has(q.id)) {
        const { explanation: _, ...rest } = q;
        return rest;
      }
      return q;
    }),
  };
}
