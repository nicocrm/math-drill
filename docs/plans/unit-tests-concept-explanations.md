# Proposed Unit Tests for Concept Explanations Feature

## Overview

Unit tests for the concept explanations feature cover: schema validation, verification logic (with mocked LLM), and prompt content. No UI component tests.

---

## 1. Exercise Schema (`src/lib/exerciseSchema.test.ts`)

**Purpose**: Ensure the `explanation` field is correctly validated.

| Test | Description |
|------|-------------|
| `accepts question with explanation` | Parse a valid question object that includes `explanation: "To add fractions, find a common denominator."` — expect no throw |
| `accepts question without explanation` | Parse a valid question object omitting `explanation` — expect no throw |
| `accepts empty string explanation` | Parse `explanation: ""` — expect success (optional allows empty) |
| `rejects non-string explanation` | Parse `explanation: 123` — expect Zod validation error |

---

## 2. Prompts (`src/lib/extraction/prompts.test.ts`)

**Purpose**: Ensure the generation prompt includes explanation instructions and that `parseAndValidateExerciseSet` handles explanations.

| Test | Description |
|------|-------------|
| `SYSTEM_PROMPT includes explanation in schema` | `expect(SYSTEM_PROMPT).toContain('"explanation"')` |
| `SYSTEM_PROMPT includes anti-hallucination rules` | `expect(SYSTEM_PROMPT).toContain('Do NOT invent')` |
| `parseAndValidateExerciseSet accepts exercise with explanations` | Parse JSON from mock-exercise.json (with explanations) — expect parsed result to have `explanation` on questions |
| `parseAndValidateExerciseSet preserves explanation field` | Parse, then assert `result.questions[0].explanation === "Addition combines two numbers..."` |

---

## 3. Verification Logic (`src/lib/extraction/verifyExplanations.test.ts`)

**Purpose**: Test `verifyExplanations` behavior with mocked OpenAI/Anthropic APIs and env vars.

**Setup**: Mock `openai` and `@anthropic-ai/sdk` modules. Use `vi.stubEnv` for `VERIFY_EXPLANATIONS` and `EXTRACTION_PROVIDER`. Restore env in `afterEach`.

| Test | Description |
|------|-------------|
| `returns exercise unchanged when VERIFY_EXPLANATIONS=false` | Set `VERIFY_EXPLANATIONS=false`, pass exercise with explanations — expect same exercise returned, explanations intact |
| `returns exercise unchanged when no questions have explanations` | Pass exercise with no `explanation` on any question — expect same exercise returned |
| `returns exercise unchanged when all explanations are empty/whitespace` | Pass questions with `explanation: ""` or `explanation: "   "` — expect no API call, same exercise |
| `strips explanation when verification returns valid=false` | Mock API to return `[{ questionId: "q1", valid: false, issues: ["..."] }]` — expect `q1` has no `explanation` in result |
| `keeps explanation when verification returns valid=true` | Mock API to return `[{ questionId: "q1", valid: true }]` — expect `q1.explanation` preserved |
| `strips only invalid explanations when mixed results` | Two questions: q1 valid, q2 invalid. Mock returns both. Expect q1 keeps explanation, q2 loses it |
| `strips all explanations on API failure` | Mock API to throw — expect returned exercise has no explanations on any question |
| `handles verification response with markdown wrapper` | Mock API to return `"Here is the result:\n[{\"questionId\":\"q1\",\"valid\":true}]"` — expect parse succeeds, no strip |

**Mocking approach**:

```ts
// Mock OpenAI - verifyExplanations uses it when EXTRACTION_PROVIDER=openai
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: vi.fn().mockResolvedValue({
        output_text: '[{"questionId":"q1","valid":true}]',
      }),
    },
  })),
}));

// Mock Anthropic similarly for EXTRACTION_PROVIDER=anthropic
vi.mock("@anthropic-ai/sdk", () => ({ ... }));
```

Override `mockResolvedValue` per test to vary the verification response.

---

## File Summary

| File | Action |
|------|--------|
| `src/lib/exerciseSchema.test.ts` | **New** — schema tests |
| `src/lib/extraction/prompts.test.ts` | **Extend** — add explanation-related tests |
| `src/lib/extraction/verifyExplanations.test.ts` | **New** — verification tests with mocks |

---

## Dependencies

- No new packages required.
