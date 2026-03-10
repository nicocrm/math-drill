import { describe, it, expect } from "vitest";
import { validateAnswerMath } from "./prompts";

describe("validateAnswerMath", () => {
  it("accepts null answerMath for open type", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "open", answerMath: null })
    ).not.toThrow();
  });

  it("throws for open type with non-null answerMath", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "open", answerMath: "x" })
    ).toThrow("open type must have answerMath: null");
  });

  it("accepts string[] answerMath for multiple_choice", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "multiple_choice", answerMath: ["a"] })
    ).not.toThrow();
  });

  it("throws for multiple_choice with string answerMath", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "multiple_choice", answerMath: "a" })
    ).toThrow("multiple_choice must have answerMath as string[]");
  });

  it("accepts true/false for true_false type", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "true_false", answerMath: "true" })
    ).not.toThrow();
    expect(() =>
      validateAnswerMath({ id: "q1", type: "true_false", answerMath: "false" })
    ).not.toThrow();
  });

  it("throws for true_false with invalid answerMath", () => {
    expect(() =>
      validateAnswerMath({ id: "q1", type: "true_false", answerMath: "yes" })
    ).toThrow('true_false must have answerMath "true" or "false"');
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
