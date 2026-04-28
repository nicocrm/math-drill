// Types
export type {
  QuestionType,
  Choice,
  Question,
  ExerciseSet,
  SessionAnswer,
  Session,
} from "./types/exercise";

// Schemas
export { exerciseSetSchema } from "./exerciseSchema";
export type { ExerciseSetSchema } from "./exerciseSchema";

// Math validation
export {
  checkFraction,
  checkExpression,
  checkMultipleChoice,
  checkTrueFalse,
} from "./mathValidation";

// Extraction
export { SYSTEM_PROMPT, validateAnswerMath, parseAndValidateExerciseSet } from "./extraction/prompts";
export { generateExercisesFromPdfOpenAI } from "./extraction/openaiProvider";
export { verifyExplanations } from "./extraction/verifyExplanations";
export type { DemotionRecord } from "./extraction/crossCheckAnswers";
export { generateExercisesFromPdf } from "./generateExercisesFromPdf";
export type { ExtractionProvider } from "./generateExercisesFromPdf";

// Storage interfaces (types only — implementations use Node.js APIs)
export type { ExerciseStorage, FileStorage } from "./storage";

// Job status (types + constants only)
export type { JobStatus, IngestStep, JobState, JobStatusStore } from "./jobStatus";
export { STEP_PROGRESS } from "./jobStatus";

// Auth
export { verifyAuth, requireAuth, HttpError } from "./auth";
export type { AuthResult } from "./auth";
