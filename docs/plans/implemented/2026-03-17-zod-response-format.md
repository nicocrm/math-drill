# Use `zodResponseFormat` for OpenAI structured outputs

## Problem

OpenAI sometimes returns malformed JSON (whitespace padding, unclosed objects) despite using `json_schema` response format. We maintain a hand-written JSON schema (`EXERCISE_SET_JSON_SCHEMA`) that duplicates the Zod schema in `exerciseSchema.ts`.

## Solution

Use `zodResponseFormat` from `openai/helpers/zod` to auto-generate the JSON schema from our existing Zod schema, and get automatic parsing via `response.output_parsed`.

## Changes

### 1. Extend `exerciseSetSchema` with error fields (`packages/core/src/exerciseSchema.ts`)

Create a new Zod schema for the LLM response that wraps the exercise set with optional error/message fields:

```ts
export const llmResponseSchema = z.object({
  error: z.string().nullable(),
  message: z.string().nullable(),
  id: z.string(),
  filename: z.string(),
  title: z.string(),
  subject: z.string(),
  createdAt: z.string(),
  sections: z.array(sectionSchema),
  questions: z.array(questionSchema),
});
```

Note: `zodResponseFormat` requires all fields to be required (no `.optional()`). Nullable fields must use `.nullable()`. The existing `questionSchema` uses `.nullish()` and `.optional()` which need to be replaced with `.nullable()` for the LLM-facing schema variant.

### 2. Create LLM-specific question schema (`packages/core/src/exerciseSchema.ts`)

Create `llmQuestionSchema` where all optional fields become `.nullable()` instead of `.optional()` / `.nullish()`, since OpenAI structured outputs require all fields present. Keep the existing `questionSchema` with its transforms for internal use.

### 3. Update `openaiProvider.ts` (`packages/core/src/extraction/openaiProvider.ts`)

- Remove the hand-written `EXERCISE_SET_JSON_SCHEMA` constant
- Import `zodResponseFormat` from `openai/helpers/zod`
- Import `llmResponseSchema` from `exerciseSchema`
- Switch from `client.responses.create()` to `client.chat.completions.create()` with `response_format: zodResponseFormat(llmResponseSchema, "exercise_set")`
  - Or if using Responses API: pass `text.format` using the zod-generated schema
- Use `zodResponseFormat` to generate the schema:
  ```ts
  import { zodResponseFormat } from "openai/helpers/zod";

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    max_output_tokens: 8192,
    instructions: SYSTEM_PROMPT,
    text: {
      format: zodResponseFormat(llmResponseSchema, "exercise_set"),
    },
    input: [ /* ... same as before ... */ ],
  });
  ```
- Parse using `llmResponseSchema.parse(JSON.parse(response.output_text))` — the structured output guarantees valid JSON, and Zod handles transforms/validation
- Remove fallback JSON dump logic (structured output w/ zod ensures schema compliance)

### 4. Update `parseAndValidateExerciseSet` (`packages/core/src/extraction/prompts.ts`)

- Accept pre-parsed object (from Zod) in addition to raw string
- Or keep as-is since the JSON is guaranteed valid by structured outputs; the function still does `validateAnswerMath` which remains useful

### 5. Tests

- Unit test: verify `llmResponseSchema` parses a valid exercise set response
- Unit test: verify `llmResponseSchema` parses an error response (`error: "not_math_exercise"`)
- Unit test: verify nullable fields work correctly (choices: null, hint: null, etc.)

## Migration notes

- No API/UI changes — only the LLM call internals change
- The `SYSTEM_PROMPT` JSON schema documentation in the prompt can be simplified since the model gets the schema via `response_format`, but keeping it doesn't hurt
- Keep the `DEBUG_LLM_OUTPUT` dump as a safety net during transition
