import { describe, it, expect, vi, beforeEach } from "vitest";
import { crossCheckAnswers, type DemotionRecord } from "./crossCheckAnswers";
import { parseAndValidateExerciseSet } from "./prompts";
import type { Question } from "../types/exercise";

function makeNumericQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    type: "numeric",
    section: "s1",
    points: 2,
    prompt: "What is $1/2$?",
    answerMath: "1/2",
    answerLatex: "\\frac{1}{2}",
    canonicalValue: 0.5,
    requiresSteps: false,
    ...overrides,
  };
}

function makeMultipleChoiceQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    type: "multiple_choice",
    section: "s1",
    points: 2,
    prompt: "Which is positive?",
    choices: [
      { id: "a", latex: "1", correct: true },
      { id: "b", latex: "-1", correct: false },
    ],
    answerMath: ["a"],
    requiresSteps: false,
    ...overrides,
  };
}

describe("crossCheckAnswers - numeric/expression", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("passes a consistent numeric question unchanged", () => {
    const q = makeNumericQuestion();
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("numeric");
    expect(result[0].answerMath).toBe("1/2");
  });

  it("passes sqrt(2) with correct canonicalValue", () => {
    const q = makeNumericQuestion({
      id: "q1",
      answerMath: "sqrt(2)",
      canonicalValue: Math.sqrt(2),
      answerLatex: "\\sqrt{2}",
    });
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("numeric");
  });

  it("demotes when canonicalValue disagrees with answerMath evaluation", () => {
    const q = makeNumericQuestion({ canonicalValue: 999 }); // wrong canonical
    const demotions: DemotionRecord[] = [];
    const result = crossCheckAnswers([q], "ex-1", demotions);
    expect(result[0].type).toBe("open");
    expect(result[0].answerMath).toBeNull();
    expect(demotions).toHaveLength(1);
    expect(demotions[0].reason).toContain("relative difference exceeds tolerance");
    expect(demotions[0].conflictingValues).toMatchObject({
      evaluated: 0.5,
      canonicalValue: 999,
    });
  });

  it("demotes when answerMath is not evaluable", () => {
    const q = makeNumericQuestion({ answerMath: "x + 1", canonicalValue: 2 });
    const demotions: DemotionRecord[] = [];
    const result = crossCheckAnswers([q], "ex-1", demotions);
    expect(result[0].type).toBe("open");
    expect(demotions[0].reason).toContain("failed to evaluate");
  });

  it("includes exerciseId and questionId in demotion record", () => {
    const q = makeNumericQuestion({ id: "q3", canonicalValue: 0 });
    const demotions: DemotionRecord[] = [];
    crossCheckAnswers([q], "exercise-abc", demotions);
    expect(demotions[0].exerciseId).toBe("exercise-abc");
    expect(demotions[0].questionId).toBe("q3");
    expect(demotions[0].originalType).toBe("numeric");
  });

  it("handles expression type the same as numeric", () => {
    const q = makeNumericQuestion({ type: "expression", answerMath: "2^3", canonicalValue: 8 });
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("expression");
  });

  it("demotes expression when canonicalValue is wrong", () => {
    const q = makeNumericQuestion({
      type: "expression",
      answerMath: "2^3",
      canonicalValue: 7,
    });
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("open");
  });

  it("passes answers near zero with small absolute error", () => {
    const q = makeNumericQuestion({ answerMath: "0", canonicalValue: 0 });
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("numeric");
  });

  it("passes negative answers", () => {
    const q = makeNumericQuestion({ answerMath: "-3/4", canonicalValue: -0.75 });
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("numeric");
  });
});

describe("crossCheckAnswers - multiple_choice", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("passes consistent multiple_choice question unchanged", () => {
    const q = makeMultipleChoiceQuestion();
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("multiple_choice");
    expect(result[0].answerMath).toEqual(["a"]);
  });

  it("demotes when answerMath id doesn't exist in choices", () => {
    const q = makeMultipleChoiceQuestion({ answerMath: ["z"] }); // "z" doesn't exist
    const demotions: DemotionRecord[] = [];
    const result = crossCheckAnswers([q], "ex-1", demotions);
    expect(result[0].type).toBe("open");
    expect(demotions[0].reason).toContain("do not exist");
  });

  it("demotes when correct flags don't match answerMath", () => {
    const q = makeMultipleChoiceQuestion({
      choices: [
        { id: "a", latex: "1", correct: false }, // flag says wrong
        { id: "b", latex: "-1", correct: true },  // flag says right
      ],
      answerMath: ["a"], // answerMath says "a" is correct
    });
    const demotions: DemotionRecord[] = [];
    const result = crossCheckAnswers([q], "ex-1", demotions);
    expect(result[0].type).toBe("open");
    expect(demotions[0].reason).toContain("do not match answerMath ids");
  });

  it("demotes when choices are missing correct flags", () => {
    const q = makeMultipleChoiceQuestion({
      choices: [
        { id: "a", latex: "1" }, // no correct flag
        { id: "b", latex: "-1", correct: false },
      ],
      answerMath: ["a"],
    });
    const demotions: DemotionRecord[] = [];
    const result = crossCheckAnswers([q], "ex-1", demotions);
    expect(result[0].type).toBe("open");
    expect(demotions[0].reason).toContain("missing correct flag");
    expect(demotions[0].conflictingValues).toMatchObject({
      choicesMissingFlags: ["a"],
    });
  });

  it("passes multiple-answer multiple_choice", () => {
    const q = makeMultipleChoiceQuestion({
      choices: [
        { id: "a", latex: "1", correct: true },
        { id: "b", latex: "2", correct: true },
        { id: "c", latex: "3", correct: false },
      ],
      answerMath: ["a", "b"],
    });
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("multiple_choice");
  });
});

describe("crossCheckAnswers - passthrough types", () => {
  it("leaves true_false questions unchanged", () => {
    const q: Question = {
      id: "q1",
      type: "true_false",
      section: "s1",
      points: 1,
      prompt: "Is 1+1=2?",
      answerMath: "true",
      requiresSteps: false,
    };
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("true_false");
    expect(result[0].answerMath).toBe("true");
  });

  it("leaves open questions unchanged", () => {
    const q: Question = {
      id: "q1",
      type: "open",
      section: "s1",
      points: 1,
      prompt: "Explain.",
      answerMath: null,
      requiresSteps: false,
    };
    const result = crossCheckAnswers([q], "ex-1");
    expect(result[0].type).toBe("open");
    expect(result[0].answerMath).toBeNull();
  });
});

describe("crossCheckAnswers - integration with parseAndValidateExerciseSet", () => {
  it("a synthetic response with contradictory answerMath/canonicalValue is demoted to open", async () => {
    const raw = JSON.stringify({
      id: "ex-bad",
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
          prompt: "What is $1/2$?",
          answerMath: "1/2",
          answerLatex: "0.5",
          canonicalValue: 999, // contradicts answerMath
          requiresSteps: false,
        },
      ],
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await parseAndValidateExerciseSet(raw);
    expect(result.questions[0].type).toBe("open");
    expect(result.questions[0].answerMath).toBeNull();
  });

  it("a synthetic response with mismatched multiple_choice flags is demoted to open", async () => {
    const raw = JSON.stringify({
      id: "ex-bad-mc",
      filename: "test.pdf",
      title: "Test",
      subject: "Math",
      createdAt: new Date().toISOString(),
      sections: [{ id: "s1", label: "Section 1", maxPoints: 10 }],
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          section: "s1",
          points: 2,
          prompt: "Which?",
          choices: [
            { id: "a", latex: "1", correct: false },
            { id: "b", latex: "2", correct: true },
          ],
          answerMath: ["a"], // contradicts correct flags
          canonicalValue: null,
          requiresSteps: false,
        },
      ],
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await parseAndValidateExerciseSet(raw);
    expect(result.questions[0].type).toBe("open");
    expect(result.questions[0].answerMath).toBeNull();
  });
});
