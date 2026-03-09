import { create, all } from "mathjs";
import type { ExerciseSet } from "@/types/exercise";
import { exerciseSetSchema } from "../exerciseSchema";

const math = create(all);

export const SYSTEM_PROMPT = `You are an expert at extracting structured exercise data from PDF documents.

Extract the exercise set from the PDF and return a single JSON object matching this schema:

{
  "id": "string (UUID)",
  "filename": "string (original filename)",
  "title": "string",
  "subject": "string",
  "createdAt": "string (ISO 8601 date)",
  "sections": [{ "id": "string", "label": "string", "maxPoints": number }],
  "questions": [{
    "id": "string (e.g. q1, q2a)",
    "type": "multiple_choice" | "true_false" | "numeric" | "expression" | "open",
    "section": "string (section id)",
    "points": number,
    "prompt": "string (use $...$ for math, e.g. $\\\\frac{1}{2}$)",
    "choices": [{ "id": "string", "latex": "string (pure LaTeX, no $ delimiters)" }] (only for multiple_choice),
    "answerMath": "string | string[] | null",
    "answerLatex": "string (KaTeX for display)",
    "requiresSteps": boolean,
    "requiresExample": boolean (only for true_false, if counterexample needed when false),
    "hint": "string (optional)"
  }]
}

Rules:
- For prompt text with math, use $...$ delimiters. LaTeX inside: e.g. $\\\\frac{1}{2}$ or $x^2$.
- For choice.latex, use pure LaTeX only (no $ delimiters), e.g. \\\\left(\\\\frac{2}{3}\\\\right)^2.
- answerMath: For numeric/expression use mathjs-evaluable string (e.g. "2/3", "(1/2)^3").
- answerMath: For multiple_choice use string[] of correct choice ids.
- answerMath: For true_false use "true" or "false".
- answerMath: For type "open" use null (ungraded).
- answerLatex: KaTeX string for displaying the correct answer.
- Return ONLY valid JSON, no markdown or extra text.`;

export function validateAnswerMath(question: {
  id: string;
  type: string;
  answerMath: string | string[] | null;
}): void {
  if (question.type === "open") {
    if (question.answerMath !== null) {
      throw new Error(`Question ${question.id}: open type must have answerMath: null`);
    }
    return;
  }
  if (question.type === "multiple_choice") {
    const arr = question.answerMath;
    if (!Array.isArray(arr)) {
      throw new Error(`Question ${question.id}: multiple_choice must have answerMath as string[]`);
    }
    return;
  }
  if (question.type === "true_false") {
    const s = question.answerMath;
    if (s !== "true" && s !== "false") {
      throw new Error(`Question ${question.id}: true_false must have answerMath "true" or "false"`);
    }
    return;
  }
  if (question.type === "numeric" || question.type === "expression") {
    const s = question.answerMath;
    if (typeof s !== "string") {
      throw new Error(`Question ${question.id}: numeric/expression must have answerMath as string`);
    }
    try {
      const result = math.parse(s.trim()).evaluate();
      if (typeof result !== "number") {
        throw new Error("Not numeric");
      }
    } catch {
      throw new Error(
        `Question ${question.id}: answerMath "${s}" is not a valid mathjs-evaluable numeric expression`
      );
    }
  }
}

export function parseAndValidateExerciseSet(raw: string): ExerciseSet {
  let trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    trimmed = jsonMatch[0];
  }

  const parsed = JSON.parse(trimmed) as unknown;
  const result = exerciseSetSchema.parse(parsed) as ExerciseSet;

  for (const q of result.questions) {
    validateAnswerMath(q);
  }

  return result;
}
