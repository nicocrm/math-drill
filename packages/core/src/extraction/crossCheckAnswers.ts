import { create, all } from "mathjs";
import type { Question } from "../types/exercise";

const math = create(all);

/** Relative tolerance for numeric comparisons (1 part per million). */
const REL_TOL = 1e-6;
/** Absolute tolerance floor, handles answers near zero. */
const ABS_TOL = 1e-9;

function numericallySame(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b), ABS_TOL / REL_TOL);
  return diff / scale < REL_TOL;
}

export interface DemotionRecord {
  exerciseId: string;
  questionId: string;
  originalType: string;
  reason: string;
  conflictingValues: Record<string, unknown>;
}

/**
 * Phase 2: cross-check parsed LLM answers for internal consistency.
 *
 * For numeric/expression questions, verifies that evaluating answerMath
 * yields the same number as canonicalValue (within relative tolerance).
 *
 * For multiple_choice questions, verifies that the set of choice ids
 * with correct:true exactly matches the answerMath id array, and that
 * every answerMath id exists in the choices list.
 *
 * Questions that fail are demoted to type "open" with answerMath: null.
 * Every demotion is logged to console (permanent diagnostic signal) and
 * appended to the provided demotions array.
 *
 * @param questions - questions from the parsed exercise set
 * @param exerciseId - used only for logging
 * @param demotions - optional output array; each demotion appended here
 * @returns new array with failing questions demoted to open
 */
export function crossCheckAnswers(
  questions: Question[],
  exerciseId: string,
  demotions: DemotionRecord[] = []
): Question[] {
  return questions.map((q) => {
    try {
      const result = checkQuestion(q);
      if (result === null) return q; // no issue
      // result is a demotion reason
      const record: DemotionRecord = {
        exerciseId,
        questionId: q.id,
        originalType: q.type,
        reason: result.reason,
        conflictingValues: result.conflictingValues,
      };
      demotions.push(record);
      console.warn(
        "[cross-check] Demoting question to open:",
        JSON.stringify(record)
      );
      return {
        ...q,
        type: "open" as const,
        answerMath: null,
        answerLatex: undefined,
        choices: undefined,
        canonicalValue: undefined,
      };
    } catch (err) {
      // Unexpected error during cross-check — demote defensively
      const record: DemotionRecord = {
        exerciseId,
        questionId: q.id,
        originalType: q.type,
        reason: `Unexpected cross-check error: ${String(err)}`,
        conflictingValues: {},
      };
      demotions.push(record);
      console.error("[cross-check] Unexpected error, demoting:", JSON.stringify(record), err);
      return {
        ...q,
        type: "open" as const,
        answerMath: null,
        answerLatex: undefined,
        choices: undefined,
        canonicalValue: undefined,
      };
    }
  });
}

type CheckResult = null | { reason: string; conflictingValues: Record<string, unknown> };

function checkQuestion(q: Question): CheckResult {
  if (q.type === "numeric" || q.type === "expression") {
    return checkNumericExpression(q);
  }
  if (q.type === "multiple_choice") {
    return checkMultipleChoice(q);
  }
  // true_false and open: phase 2 adds nothing
  return null;
}

function checkNumericExpression(q: Question): CheckResult {
  const s = q.answerMath;
  if (typeof s !== "string") {
    return {
      reason: "answerMath is not a string for numeric/expression question",
      conflictingValues: { answerMath: s },
    };
  }

  const canonical = q.canonicalValue;
  if (canonical === null || canonical === undefined || typeof canonical !== "number") {
    // Phase 1 shape validation should have already caught this, but be defensive
    return {
      reason: "canonicalValue is missing for numeric/expression question",
      conflictingValues: { canonicalValue: canonical },
    };
  }

  let evaluated: number;
  try {
    const result = math.parse(s.trim()).evaluate();
    if (typeof result !== "number") {
      return {
        reason: `answerMath "${s}" does not evaluate to a number`,
        conflictingValues: { answerMath: s, evaluatedType: typeof result },
      };
    }
    evaluated = result;
  } catch (err) {
    return {
      reason: `answerMath "${s}" failed to evaluate: ${String(err)}`,
      conflictingValues: { answerMath: s },
    };
  }

  if (!numericallySame(evaluated, canonical)) {
    return {
      reason: `answerMath evaluates to ${evaluated} but canonicalValue is ${canonical} (relative difference exceeds tolerance)`,
      conflictingValues: { answerMath: s, evaluated, canonicalValue: canonical },
    };
  }

  return null;
}

function checkMultipleChoice(q: Question): CheckResult {
  const answerMathIds = q.answerMath;
  if (!Array.isArray(answerMathIds)) {
    return {
      reason: "answerMath is not an array for multiple_choice question",
      conflictingValues: { answerMath: answerMathIds },
    };
  }

  const choices = q.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    // No choices to check against — cannot verify
    return null;
  }

  // Check every answerMath id refers to an existing choice
  const choiceIds = new Set(choices.map((c) => c.id));
  const nonExistentIds = answerMathIds.filter((id) => !choiceIds.has(id));
  if (nonExistentIds.length > 0) {
    return {
      reason: `answerMath references choice ids that do not exist: ${JSON.stringify(nonExistentIds)}`,
      conflictingValues: { answerMath: answerMathIds, availableChoiceIds: [...choiceIds] },
    };
  }

  // Check that per-choice correct flags match answerMath ids
  const hasMissingFlags = choices.some(
    (c) => c.correct === null || c.correct === undefined
  );
  if (hasMissingFlags) {
    // Phase 1 shape validation should have caught this, but be defensive
    return null; // cannot cross-check without flags
  }

  const flaggedIds = choices
    .filter((c) => c.correct === true)
    .map((c) => c.id)
    .sort();
  const sortedAnswerMathIds = [...answerMathIds].sort();

  if (
    flaggedIds.length !== sortedAnswerMathIds.length ||
    !flaggedIds.every((id, i) => id === sortedAnswerMathIds[i])
  ) {
    return {
      reason: `per-choice correct flags (ids: ${JSON.stringify(flaggedIds)}) do not match answerMath ids (${JSON.stringify(sortedAnswerMathIds)})`,
      conflictingValues: {
        answerMath: answerMathIds,
        flaggedCorrectIds: flaggedIds,
      },
    };
  }

  return null;
}
