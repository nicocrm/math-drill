import { describe, it, expect } from "vitest";
import { llmResponseSchema } from "./exerciseSchema";

const validResponse = {
  error: null,
  message: null,
  id: "ex-001",
  filename: "test.pdf",
  title: "Math Quiz",
  subject: "math",
  createdAt: "2026-03-17",
  sections: [{ id: "s1", label: "Section 1", maxPoints: 10 }],
  questions: [
    {
      id: "q1",
      type: "numeric" as const,
      section: "s1",
      points: 5,
      prompt: "What is 2+2?",
      choices: null,
      answerMath: "4",
      answerLatex: "4",
      canonicalValue: 4,
      requiresSteps: false,
      requiresExample: null,
      hint: null,
      explanation: "2+2=4",
    },
  ],
};

describe("llmResponseSchema", () => {
  it("parses a valid exercise set response", () => {
    const result = llmResponseSchema.parse(validResponse);
    expect(result.questions).toHaveLength(1);
    expect(result.error).toBeNull();
  });

  it("parses an error response", () => {
    const result = llmResponseSchema.parse({
      ...validResponse,
      error: "not_math_exercise",
      message: "This PDF is not a math exercise",
      questions: [],
    });
    expect(result.error).toBe("not_math_exercise");
  });

  it("handles nullable fields correctly", () => {
    const result = llmResponseSchema.parse(validResponse);
    expect(result.questions[0].choices).toBeNull();
    expect(result.questions[0].hint).toBeNull();
    expect(result.questions[0].requiresExample).toBeNull();
  });

  it("parses questions with choices", () => {
    const result = llmResponseSchema.parse({
      ...validResponse,
      questions: [
        {
          ...validResponse.questions[0],
          type: "multiple_choice",
          choices: [
            { id: "a", latex: "3", correct: false },
            { id: "b", latex: "4", correct: true },
          ],
          answerMath: ["b"],
          canonicalValue: null,
        },
      ],
    });
    expect(result.questions[0].choices).toHaveLength(2);
  });
});
