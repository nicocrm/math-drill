import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  validateAnswerMath,
  SYSTEM_PROMPT,
  parseAndValidateExerciseSet,
} from "./prompts";

describe("validateAnswerMath", () => {
  it("accepts null answerMath for open type", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "open", answerMath: null })
    ).not.toThrow();
  });

  it("throws for open type with non-null answerMath", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "open", answerMath: "x" })
    ).toThrow('open type must have answerMath: null, got: "x"');
  });

  it("accepts string[] answerMath for multiple_choice", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "multiple_choice", answerMath: ["a"] })
    ).not.toThrow();
  });

  it("throws for multiple_choice with string answerMath", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "multiple_choice", answerMath: "a" })
    ).toThrow('multiple_choice must have answerMath as string[], got: "a"');
  });

  it("accepts true/false for true_false type", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "true_false", answerMath: "true" })
    ).not.toThrow();
    expect(() =>
      validateAnswerMath({ id: "q1", type: "true_false", answerMath: "false" })
    ).not.toThrow();
  });

  it("accepts vrai/faux and normalizes to true/false", () => {
    const qVrai = { id: "q1", type: "true_false" as const, answerMath: "vrai" };
    const qFaux = { id: "q2", type: "true_false" as const, answerMath: "faux" };
    expect(() => validateAnswerMath(qVrai)).not.toThrow();
    expect(() => validateAnswerMath(qFaux)).not.toThrow();
    expect(qVrai.answerMath).toBe("true");
    expect(qFaux.answerMath).toBe("false");
  });

  it("throws for true_false with invalid answerMath", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "true_false", answerMath: "invalid" })
    ).toThrow(
      'Question q1: true_false must have answerMath "true" or "false", got: "invalid"'
    );
  });

  it("accepts valid mathjs string for numeric type", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "numeric", answerMath: "2/3" })
    ).not.toThrow();
  });

  it("throws for numeric with invalid answerMath", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "numeric", answerMath: "not a number" })
    ).toThrow("not a valid mathjs-evaluable numeric expression");
  });
});

describe("SYSTEM_PROMPT - explanation", () => {
  it("includes explanation in schema", () => {
    expect(SYSTEM_PROMPT).toContain('"explanation"');
  });

  it("includes anti-hallucination rules", () => {
    expect(SYSTEM_PROMPT).toContain("Do NOT invent");
  });
});

describe("parseAndValidateExerciseSet - explanation", () => {
  it("accepts exercise with explanations", () => {
    const raw = readFileSync(
      join(process.cwd(), "tests/fixtures/mock-exercise.json"),
      "utf-8"
    );
    const result = parseAndValidateExerciseSet(raw);
    const withExplanation = result.questions.filter((q) => q.explanation);
    expect(withExplanation.length).toBeGreaterThan(0);
  });

  it("preserves explanation field", () => {
    const raw = readFileSync(
      join(process.cwd(), "tests/fixtures/mock-exercise.json"),
      "utf-8"
    );
    const result = parseAndValidateExerciseSet(raw);
    expect(result.questions[0].explanation).toBe(
      "Addition combines two numbers to find their total."
    );
  });
});
