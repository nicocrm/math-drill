import { writeFileSync } from "fs";
import type { ExerciseSet } from "../types/exercise";
import { exerciseSetSchema } from "../exerciseSchema";
import { crossCheckAnswers } from "./crossCheckAnswers";

export const SYSTEM_PROMPT = `You are an expert at creating math exercises. Your task is to GENERATE NEW exercises inspired by a reference PDF—not to copy or extract the exact exercises from it.

If the PDF does not appear to contain math exercises or math homework (e.g., it is a novel, a news article, an image without math content, a blank page, etc.), respond with ONLY this JSON and nothing else:
{"error": "not_math_exercise", "message": "<brief human-readable reason>"}

Otherwise:

Use the PDF as a template: match its subject, difficulty, question types, section structure, and pedagogical style. But create entirely NEW questions with different numbers, different wording, and different prompts. Do not reproduce the PDF's exercises verbatim. Preserve a similar section structure (e.g., same number of sections and labels) if the PDF has sections.

Return a single JSON object matching this schema:

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
    "choices": [{ "id": "string", "latex": "string (pure LaTeX, no $ delimiters)", "correct": boolean }] (only for multiple_choice),
    "answerMath": "string | string[] | null",
    "answerLatex": "string (KaTeX for display)",
    "canonicalValue": number | null,
    "requiresSteps": boolean,
    "requiresExample": boolean (only for true_false, if counterexample needed when false),
    "hint": "string (optional)",
    "explanation": "string (optional)"
  }]
}

Rules:
- For prompt text with math, use $...$ delimiters. LaTeX inside: e.g. $\\\\frac{1}{2}$ or $x^2$.
- For choice.latex, use pure LaTeX only (no $ delimiters), e.g. \\\\left(\\\\frac{2}{3}\\\\right)^2.
- answerMath: For numeric/expression use a mathjs-evaluable string that evaluates to a NUMBER (e.g. "2/3", "(1/2)^3", "sqrt(2)"). NO free variables (x, y, n, etc.)—the expression must evaluate to a concrete number.
- answerMath: For questions with symbolic answers (polynomials, factored forms, expressions containing variables), use type "open" and answerMath: null.
- answerMath: For multiple_choice use string[] of correct choice ids.
- answerMath: For true_false use EXACTLY the lowercase strings "true" or "false" (never "vrai", "faux", "True", "False", "yes", "no", etc.).
- answerMath: For type "open" use null (ungraded).
- answerLatex: KaTeX string for displaying the correct answer.
- canonicalValue: For numeric/expression, compute the numeric result of answerMath yourself and record it here as a plain number (e.g. 0.5 for "1/2", 1.4142135623730951 for "sqrt(2)"). This must equal the value of evaluating answerMath. For all other types, set canonicalValue to null.
- choices[].correct: For multiple_choice, each choice must have correct: true if it is a correct answer, correct: false otherwise. The ids of choices with correct: true MUST exactly match the ids in answerMath. Omit the choices field entirely for all other question types.
- CONSISTENCY RULE: For numeric/expression questions, answerMath, answerLatex, and canonicalValue must all represent the same number. If you cannot guarantee this (e.g. the answer involves a variable or you are unsure of the numeric value), demote the question to type "open" with answerMath: null and canonicalValue: null instead of risking a wrong graded answer.
- CONSISTENCY RULE: For multiple_choice questions, the ids in answerMath must exactly match the ids of choices where correct: true. If these would differ, demote to type "open" with answerMath: null.
- explanation: A brief, factual explanation of the mathematical concept being tested. Use only well-established mathematical facts. Do NOT invent examples, numbers, or derivations not present in the question. Ground the explanation in the concept itself (e.g., fraction simplification, order of operations), not in the specific numbers of this question. Keep it 1–3 sentences.
- Return ONLY valid JSON, no markdown or extra text.`;

export function validateAnswerMath(question: {
  id: string;
  type: string;
  answerMath: string | string[] | null;
  choices?: Array<{ id: string; correct?: boolean | null }>;
  canonicalValue?: number | null;
}): void {
  if (question.type === "open") {
    if (question.answerMath !== null) {
      throw new Error(
        `Question ${question.id}: open type must have answerMath: null, got: ${JSON.stringify(question.answerMath)}`
      );
    }
    return;
  }
  if (question.type === "multiple_choice") {
    const arr = question.answerMath;
    if (!Array.isArray(arr)) {
      throw new Error(
        `Question ${question.id}: multiple_choice must have answerMath as string[], got: ${JSON.stringify(question.answerMath)}`
      );
    }
    // Phase 1: every choice must have an explicit correct flag
    if (Array.isArray(question.choices) && question.choices.length > 0) {
      const missingFlag = question.choices.find(
        (c) => c.correct === null || c.correct === undefined
      );
      if (missingFlag) {
        throw new Error(
          `Question ${question.id}: multiple_choice choice "${missingFlag.id}" is missing the required correct flag`
        );
      }
      // Note: consistency between correct flags and answerMath is checked in Phase 2
      // (crossCheckAnswers) which demotes rather than rejects.
    }
    return;
  }
  if (question.type === "true_false") {
    const raw = question.answerMath;
    const s =
      typeof raw === "string"
        ? raw.trim().toLowerCase()
        : raw;
    const normalized =
      s === "vrai" || s === "yes" || s === "1" || s === "oui"
        ? "true"
        : s === "faux" || s === "no" || s === "0" || s === "non"
          ? "false"
          : s;
    if (normalized !== "true" && normalized !== "false") {
      throw new Error(
        `Question ${question.id}: true_false must have answerMath "true" or "false", got: ${JSON.stringify(raw)}`
      );
    }
    if (raw !== normalized) {
      (question as { answerMath: string }).answerMath = normalized;
    }
    return;
  }
  if (question.type === "numeric" || question.type === "expression") {
    const s = question.answerMath;
    if (typeof s !== "string") {
      throw new Error(`Question ${question.id}: numeric/expression must have answerMath as string`);
    }
    // Phase 1: canonicalValue must be present
    if (question.canonicalValue === null || question.canonicalValue === undefined) {
      throw new Error(
        `Question ${question.id}: numeric/expression must have a canonicalValue (expected a number, got: ${JSON.stringify(question.canonicalValue)})`
      );
    }
    if (typeof question.canonicalValue !== "number") {
      throw new Error(
        `Question ${question.id}: canonicalValue must be a number, got: ${JSON.stringify(question.canonicalValue)}`
      );
    }
  }
}

export function parseAndValidateExerciseSet(raw: string): ExerciseSet {
  // Structured output from OpenAI is guaranteed to be valid JSON.
  let parsed: unknown;
  if (process.env.DEBUG_LLM_OUTPUT === "true") {
    const dumpPath = `/tmp/llm-parse-error-${Date.now()}.txt`;
    writeFileSync(dumpPath, `=== RAW ===\n${raw}\n`);
  }
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[extraction] JSON.parse failed.`);
    throw err;
  }

  // Check if the model signalled that the input is not a math exercise.
  // Only treat it as an error when there are no questions — the model sometimes
  // sets the error field even when it successfully extracted exercises (due to
  // the JSON schema requiring the field to always be present).
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).error === "not_math_exercise" &&
    (!Array.isArray((parsed as Record<string, unknown>).questions) ||
      ((parsed as Record<string, unknown>).questions as unknown[]).length === 0)
  ) {
    const msg = (parsed as Record<string, unknown>).message;
    throw new Error(
      `not_math_exercise: ${typeof msg === "string" ? msg : "The uploaded document does not appear to contain math exercises."}`
    );
  }
  const result = exerciseSetSchema.parse(parsed) as ExerciseSet;

  for (const q of result.questions) {
    try {
      validateAnswerMath(q);
    } catch (err) {
      console.error("[extraction] validation failed for question", q.id, {
        type: q.type,
        answerMath: q.answerMath,
        rawQuestions: result.questions.map((r) => ({
          id: r.id,
          type: r.type,
          answerMath: r.answerMath,
        })),
      });
      throw err;
    }
  }

  // Phase 2: cross-check answer fields for internal consistency;
  // demote contradictory questions to "open" rather than persisting wrong answers.
  result.questions = crossCheckAnswers(result.questions, result.id);

  return result;
}
