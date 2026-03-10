import { describe, it, expect } from "vitest";
import { exerciseSetSchema } from "./exerciseSchema";

const minimalExerciseSet = {
  id: "test-1",
  filename: "test.pdf",
  title: "Test",
  subject: "Math",
  createdAt: "2025-03-09T12:00:00.000Z",
  sections: [{ id: "s1", label: "Section 1", maxPoints: 10 }],
  questions: [
    {
      id: "q1",
      type: "numeric",
      section: "s1",
      points: 2,
      prompt: "What is 2 + 2?",
      answerMath: "4",
      requiresSteps: false,
    },
  ],
};

describe("exerciseSetSchema - explanation field", () => {
  it("accepts question with explanation", () => {
    const result = exerciseSetSchema.parse({
      ...minimalExerciseSet,
      questions: [
        {
          ...minimalExerciseSet.questions[0],
          explanation: "To add fractions, find a common denominator.",
        },
      ],
    });
    expect(result.questions[0].explanation).toBe(
      "To add fractions, find a common denominator."
    );
  });

  it("accepts question without explanation", () => {
    const result = exerciseSetSchema.parse(minimalExerciseSet);
    expect(result.questions[0].explanation).toBeUndefined();
  });

  it("accepts empty string explanation", () => {
    const result = exerciseSetSchema.parse({
      ...minimalExerciseSet,
      questions: [
        {
          ...minimalExerciseSet.questions[0],
          explanation: "",
        },
      ],
    });
    expect(result.questions[0].explanation).toBe("");
  });

  it("rejects non-string explanation", () => {
    expect(() =>
      exerciseSetSchema.parse({
        ...minimalExerciseSet,
        questions: [
          {
            ...minimalExerciseSet.questions[0],
            explanation: 123,
          },
        ],
      })
    ).toThrow();
  });
});
