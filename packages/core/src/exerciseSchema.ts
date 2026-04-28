import { z } from "zod";

const questionTypeSchema = z.enum([
  "multiple_choice",
  "true_false",
  "numeric",
  "expression",
  "open",
]);

const choiceSchema = z.object({
  id: z.string(),
  latex: z.string(),
  correct: z.boolean().nullish().transform(v => v ?? undefined),
});

const questionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  section: z.string(),
  points: z.number(),
  prompt: z.string(),
  choices: z.array(choiceSchema).nullish().transform(v => v ?? undefined),
  answerMath: z.union([z.string(), z.array(z.string()), z.null()]).transform(v => (v === "" ? null : v)),
  answerLatex: z.string().nullish(),
  requiresSteps: z.boolean(),
  requiresExample: z.boolean().nullish(),
  hint: z.string().nullish().transform(v => v ?? undefined),
  explanation: z.string().optional(),
  canonicalValue: z.number().nullish().transform(v => v ?? undefined),
});

const sectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  maxPoints: z.number(),
});

export const exerciseSetSchema = z.object({
  id: z.string(),
  filename: z.string(),
  title: z.string(),
  subject: z.string(),
  createdAt: z.string(),
  sections: z.array(sectionSchema),
  questions: z.array(questionSchema),
});

export type ExerciseSetSchema = z.infer<typeof exerciseSetSchema>;

const llmChoiceSchema = z.object({
  id: z.string(),
  latex: z.string(),
  correct: z.boolean().nullable(),
});
/**
 * LLM-facing schemas: all fields required + nullable (no .optional/.nullish)
 * as required by OpenAI structured outputs / zodResponseFormat.
 */
const llmQuestionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  section: z.string(),
  points: z.number(),
  prompt: z.string(),
  choices: z.array(llmChoiceSchema).nullable(),
  answerMath: z.union([z.string(), z.array(z.string()), z.null()]),
  answerLatex: z.string().nullable(),
  canonicalValue: z.number().nullable(),
  requiresSteps: z.boolean(),
  requiresExample: z.boolean().nullable(),
  hint: z.string().nullable(),
  explanation: z.string().nullable(),
});

export const llmResponseSchema = z.object({
  error: z.string().nullable(),
  message: z.string().nullable(),
  id: z.string(),
  filename: z.string(),
  title: z.string(),
  subject: z.string(),
  createdAt: z.string(),
  sections: z.array(sectionSchema),
  questions: z.array(llmQuestionSchema),
});
