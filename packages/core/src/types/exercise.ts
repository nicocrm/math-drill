export type QuestionType =
  | "multiple_choice" // checkbox list, one or more correct answers
  | "true_false" // exactly one of: "true" | "false"
  | "numeric" // single fraction or decimal answer
  | "expression" // multi-step calculation, validated as numeric result (no symbolic equivalence for MVP)
  | "open"; // free text, NOT graded

export interface Choice {
  id: string; // e.g. "a", "b", "c"
  latex: string; // KaTeX-renderable string, e.g. "\\left(\\frac{2}{3}\\right)^2"
  correct?: boolean; // Phase 1: per-choice correctness flag (used in extraction pipeline)
}

export interface Question {
  id: string; // e.g. "q1", "q2a"
  type: QuestionType;
  section: string; // e.g. "C1 - Connaître", "C2 - Appliquer"
  points: number;
  prompt: string; // Mixed text + math using $...$ delimiters
  choices?: Choice[]; // For multiple_choice only
  answerMath: string | string[] | null;
  answerLatex?: string; // KaTeX display string for the correct answer
  canonicalValue?: number; // Phase 1: canonical numeric value for numeric/expression questions (used in extraction pipeline)
  requiresSteps: boolean;
  requiresExample?: boolean; // For true_false: if true, student must provide a counterexample when answering "false"
  hint?: string; // Optional teacher hint
  explanation?: string; // Concept explanation shown after answering
}

export interface ExerciseSet {
  id: string;
  filename: string;
  title: string;
  subject: string;
  createdAt: string;
  createdBy?: string;
  sections: {
    id: string;
    label: string;
    maxPoints: number;
  }[];
  questions: Question[];
}

export interface SessionAnswer {
  questionId: string;
  value: string | string[];
  isCorrect: boolean | null;
  pointsAwarded: number;
  workings?: string;
}

export interface Session {
  id: string;
  exerciseSetId: string;
  startedAt: string;
  completedAt?: string;
  answers: SessionAnswer[];
}
