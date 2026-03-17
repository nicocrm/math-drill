import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
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

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures"
);

describe("parseAndValidateExerciseSet - LaTeX in valid JSON", () => {
  it("parses correctly escaped LaTeX (\\\\sqrt, \\\\frac) from valid JSON", () => {
    // With structured output the model returns properly escaped JSON
    const raw = JSON.stringify({
      id: "ex-1", filename: "t.pdf", title: "T", subject: "m",
      createdAt: "2025-01-01T00:00:00Z",
      sections: [{ id: "s1", label: "S", maxPoints: 1 }],
      questions: [{
        id: "q1", type: "numeric", section: "s1", points: 1,
        prompt: "What is $\\sqrt{2}$?",
        answerMath: "sqrt(2)", answerLatex: "\\sqrt{2}",
        requiresSteps: false,
      }],
    });
    const result = parseAndValidateExerciseSet(raw);
    expect(result.questions[0].prompt).toBe("What is $\\sqrt{2}$?");
    expect(result.questions[0].answerLatex).toBe("\\sqrt{2}");
  });

  it("parses valid JSON escapes (\\n, \\t) correctly", () => {
    const raw = JSON.stringify({
      id: "ex-1", filename: "t.pdf", title: "T", subject: "m",
      createdAt: "2025-01-01T00:00:00Z",
      sections: [{ id: "s1", label: "S", maxPoints: 1 }],
      questions: [{
        id: "q1", type: "numeric", section: "s1", points: 1,
        prompt: "Line1\nLine2",
        answerMath: "1", answerLatex: "1",
        requiresSteps: false,
      }],
    });
    const result = parseAndValidateExerciseSet(raw);
    expect(result.questions[0].prompt).toBe("Line1\nLine2");
  });
});

describe("parseAndValidateExerciseSet - explanation", () => {
  it("accepts exercise with explanations", () => {
    const raw = readFileSync(
      join(FIXTURE_DIR, "mock-exercise.json"),
      "utf-8"
    );
    const result = parseAndValidateExerciseSet(raw);
    const withExplanation = result.questions.filter((q) => q.explanation);
    expect(withExplanation.length).toBeGreaterThan(0);
  });

  it("preserves explanation field", () => {
    const raw = readFileSync(
      join(FIXTURE_DIR, "mock-exercise.json"),
      "utf-8"
    );
    const result = parseAndValidateExerciseSet(raw);
    expect(result.questions[0].explanation).toBe(
      "Addition combines two numbers to find their total."
    );
  });
});

describe("parseAndValidateExerciseSet - not_math_exercise sentinel", () => {
  it("throws with model message when error is not_math_exercise", () => {
    const raw = JSON.stringify({ error: "not_math_exercise", message: "This is a recipe book." });
    expect(() => parseAndValidateExerciseSet(raw)).toThrow("This is a recipe book.");
  });

  it("throws a fallback message when no message field", () => {
    const raw = JSON.stringify({ error: "not_math_exercise" });
    expect(() => parseAndValidateExerciseSet(raw)).toThrow(
      "The uploaded document does not appear to contain math exercises."
    );
  });

  it("does not throw for a normal exercise set", () => {
    const raw = JSON.stringify({
      id: "00000000-0000-0000-0000-000000000001",
      filename: "test.pdf",
      title: "Test",
      subject: "Math",
      createdAt: new Date().toISOString(),
      sections: [{ id: "s1", label: "Section 1", maxPoints: 10 }],
      questions: [
        {
          id: "q1",
          type: "numeric",
          section: "s1",
          points: 2,
          prompt: "What is $1+1$?",
          answerMath: "2",
          answerLatex: "2",
          requiresSteps: false,
        },
      ],
    });
    expect(() => parseAndValidateExerciseSet(raw)).not.toThrow();
  });
});
