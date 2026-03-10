import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyExplanations } from "./verifyExplanations";
import type { ExerciseSet } from "@/types/exercise";

const mockOpenAICreate = vi.fn();
const mockAnthropicCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: mockOpenAICreate,
    },
  })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockAnthropicCreate,
    },
  })),
}));

const exerciseWithExplanation: ExerciseSet = {
  id: "ex-1",
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
      answerLatex: "4",
      requiresSteps: false,
      explanation: "Addition combines two numbers.",
    },
  ],
};

const exerciseWithTwoExplanations: ExerciseSet = {
  ...exerciseWithExplanation,
  questions: [
    {
      ...exerciseWithExplanation.questions[0],
      id: "q1",
      explanation: "Addition combines two numbers.",
    },
    {
      id: "q2",
      type: "numeric",
      section: "s1",
      points: 2,
      prompt: "What is 3 + 3?",
      answerMath: "6",
      answerLatex: "6",
      requiresSteps: false,
      explanation: "Addition is combining numbers.",
    },
  ],
};

const exerciseWithoutExplanations: ExerciseSet = {
  ...exerciseWithExplanation,
  questions: [
    {
      ...exerciseWithExplanation.questions[0],
      explanation: undefined,
    },
  ],
};

describe("verifyExplanations", () => {
  const originalVerify = process.env.VERIFY_EXPLANATIONS;
  const originalProvider = process.env.EXTRACTION_PROVIDER;

  beforeEach(() => {
    process.env.VERIFY_EXPLANATIONS = "true";
    process.env.EXTRACTION_PROVIDER = "openai";
    mockOpenAICreate.mockReset();
    mockOpenAICreate.mockResolvedValue({
      output_text: '[{"questionId":"q1","valid":true}]',
    });
    mockAnthropicCreate.mockReset();
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"questionId":"q1","valid":true}]' }],
    });
  });

  afterEach(() => {
    process.env.VERIFY_EXPLANATIONS = originalVerify;
    process.env.EXTRACTION_PROVIDER = originalProvider;
  });

  it("returns exercise unchanged when VERIFY_EXPLANATIONS=false", async () => {
    process.env.VERIFY_EXPLANATIONS = "false";
    const result = await verifyExplanations(exerciseWithExplanation);
    expect(result).toEqual(exerciseWithExplanation);
    expect(result.questions[0].explanation).toBe("Addition combines two numbers.");
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it("returns exercise unchanged when no questions have explanations", async () => {
    const result = await verifyExplanations(exerciseWithoutExplanations);
    expect(result).toEqual(exerciseWithoutExplanations);
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it("returns exercise unchanged when all explanations are empty or whitespace", async () => {
    const exercise = {
      ...exerciseWithExplanation,
      questions: [
        {
          ...exerciseWithExplanation.questions[0],
          explanation: "",
        },
      ],
    };
    const result = await verifyExplanations(exercise);
    expect(result).toEqual(exercise);
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it("strips explanation when verification returns valid=false", async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      output_text: '[{"questionId":"q1","valid":false,"issues":["Invented example"]}]',
    });
    const result = await verifyExplanations(exerciseWithExplanation);
    expect(result.questions[0].explanation).toBeUndefined();
    expect(result.questions[0].prompt).toBe("What is 2 + 2?");
  });

  it("keeps explanation when verification returns valid=true", async () => {
    const result = await verifyExplanations(exerciseWithExplanation);
    expect(result.questions[0].explanation).toBe("Addition combines two numbers.");
  });

  it("strips only invalid explanations when mixed results", async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      output_text:
        '[{"questionId":"q1","valid":true},{"questionId":"q2","valid":false,"issues":["Wrong"]}]',
    });
    const result = await verifyExplanations(exerciseWithTwoExplanations);
    expect(result.questions[0].explanation).toBe("Addition combines two numbers.");
    expect(result.questions[1].explanation).toBeUndefined();
  });

  it("strips all explanations on API failure", async () => {
    mockOpenAICreate.mockRejectedValueOnce(new Error("Network error"));
    const result = await verifyExplanations(exerciseWithExplanation);
    expect(result.questions[0].explanation).toBeUndefined();
  });

  it("handles verification response with markdown wrapper", async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      output_text:
        'Here is the result:\n[{"questionId":"q1","valid":true}]\n\nHope that helps!',
    });
    const result = await verifyExplanations(exerciseWithExplanation);
    expect(result.questions[0].explanation).toBe("Addition combines two numbers.");
  });

  it("uses Anthropic when EXTRACTION_PROVIDER=anthropic", async () => {
    process.env.EXTRACTION_PROVIDER = "anthropic";
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '[{"questionId":"q1","valid":true}]' }],
    });
    const result = await verifyExplanations(exerciseWithExplanation);
    expect(result.questions[0].explanation).toBe("Addition combines two numbers.");
    expect(mockAnthropicCreate).toHaveBeenCalled();
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });
});
