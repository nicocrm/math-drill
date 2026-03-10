<!-- 7faeea32-4cc1-4a5e-afa4-fe1bebd8d623 -->
# Targeted Unit Tests Plan

## Scope

Two non-UI modules with pure, testable logic:

1. **`src/lib/mathValidation.ts`** – Core grading functions used by `ExercisePlayer` to score student answers
2. **`src/lib/extraction/prompts.ts`** – `validateAnswerMath` used to validate LLM-extracted exercise data

## Test Runner Setup

Add **Vitest** (standard for Next.js, fast, ESM-native):

- `vitest` as devDependency
- `vitest.config.ts` with path alias `@/*` → `./src/*`
- `"test": "vitest run"` and `"test:watch": "vitest"` in `package.json`

## Test Files

### 1. `src/lib/mathValidation.test.ts` (~5 tests)

| Function | Test |
|----------|------|
| `checkFraction` | Equal fractions pass (`"1/2"` vs `"1/2"`); Unicode minus `\u2212` normalizes correctly |
| `checkExpression` | Equal numeric expressions pass; tolerance for floating point (`1e-10`) |
| `checkMultipleChoice` | Order-independent match (`["a","b"]` vs `["b","a"]`); length mismatch fails |
| `checkTrueFalse` | Matching `"true"`/`"false"` passes; case-insensitive |

### 2. `src/lib/extraction/prompts.test.ts` (~4 tests)

| Scenario | Test |
|----------|------|
| `validateAnswerMath` – open | `answerMath: null` passes; `answerMath: "x"` throws |
| `validateAnswerMath` – multiple_choice | `answerMath: ["a"]` passes; `answerMath: "a"` (string) throws |
| `validateAnswerMath` – true_false | `"true"`/`"false"` pass; `"yes"` throws |
| `validateAnswerMath` – numeric | Valid mathjs string passes; invalid string throws |

## Out of Scope

- UI components (per request)
- API routes (require request/response mocking)
- Extraction providers (call external APIs)
- `parseAndValidateExerciseSet` (depends on full Zod schema; `validateAnswerMath` covers the critical validation logic)
- `ingestJobs` (simple CRUD over in-memory Map)

## File Changes Summary

| Action | Path |
|--------|------|
| Add | `vitest.config.ts` |
| Add | `src/lib/mathValidation.test.ts` |
| Add | `src/lib/extraction/prompts.test.ts` |
| Edit | `package.json` (vitest dep + scripts) |
