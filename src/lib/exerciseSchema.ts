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
});

const questionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  section: z.string(),
  points: z.number(),
  prompt: z.string(),
  choices: z.array(choiceSchema).optional(),
  answerMath: z.union([z.string(), z.array(z.string()), z.null()]),
  answerLatex: z.string().optional(),
  requiresSteps: z.boolean(),
  requiresExample: z.boolean().optional(),
  hint: z.string().optional(),
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
