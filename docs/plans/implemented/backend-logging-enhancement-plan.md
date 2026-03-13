# Backend Logging Enhancement for Document Processing Errors

**Date**: 2025-03-11  
**Status**: Implemented  
**Context**: When processing `devoir chapitre 7.pdf`, the UI shows:  
`Question q2: true_false must have answerMath "true" or "false"`  
The error reaches the UI via job status, but there is **no backend logging**—nothing appears in server logs for debugging or monitoring.

---

## Current State

### Error Flow

1. **Validation** (`src/lib/extraction/prompts.ts`): `validateAnswerMath` throws when `true_false` has invalid `answerMath` (e.g. `"yes"`, `"Oui"`, `null`).
2. **Propagation**: Error bubbles through `parseAndValidateExerciseSet` → provider (`anthropicProvider` / `openaiProvider`) → `generateExercisesFromPdf` → `runIngestJob`.
3. **Catch** (`src/app/api/ingest/route.ts`): `runIngestJob` catches, stores `err.message` in job state via `setJob(jobId, { status: "error", error, ... })`.
4. **UI**: IngestionStatus polls `/api/ingest/status`, displays `status.error`.

### Gaps

| Gap | Impact |
|-----|--------|
| No server-side logging | Errors invisible in production logs; debugging requires reproducing in UI. |
| Error message omits actual value | `true_false` error says "must have answerMath \"true\" or \"false\"" but not what was received (e.g. `"Oui"`). |
| No context in logs | Even if we logged, we'd lack `jobId`, `filename`, and stack trace. |

---

## Plan

### 1. Add Backend Logging in Ingest Route

**File**: `src/app/api/ingest/route.ts`

In the `runIngestJob` catch block, log the error before storing it in job state:

```ts
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  console.error("[ingest] job failed", {
    jobId,
    filename,
    error,
    stack: err instanceof Error ? err.stack : undefined,
  });
  setJob(jobId, {
    status: "error",
    error,
    progress: 0,
  });
}
```

**Rationale**: `console.error` is sufficient for MVP; Next.js and most hosts capture stderr. Structured object makes it easy to grep and parse. Stack trace aids debugging.

---

### 2. Enrich Validation Error Messages with Actual Value

**File**: `src/lib/extraction/prompts.ts`

For `true_false` (and similarly for `open`, `multiple_choice` where useful), include the received value in the error:

```ts
// true_false
if (s !== "true" && s !== "false") {
  throw new Error(
    `Question ${question.id}: true_false must have answerMath "true" or "false", got: ${JSON.stringify(s)}`
  );
}
```

**Rationale**: Numeric/expression already includes the value (`answerMath "${s}"`). `true_false` does not—adding it makes logs and UI more actionable (e.g. LLM returned `"Oui"` for a French PDF).

**Unit test**: Update `prompts.test.ts` to expect the new message format and assert the value is included.

---

### 3. Optional: Structured Logger (Future)

If the project grows or needs log aggregation (e.g. Datadog, CloudWatch):

- Add `pino` or similar.
- Create `src/lib/logger.ts` with `logError(jobId, filename, err)`.
- Replace `console.error` with logger call.

**Defer** for now; `console.error` is sufficient for current scope.

---

## Implementation Checklist

- [x] **1a**: Add `console.error` in `runIngestJob` catch block with `jobId`, `filename`, `error`, `stack`.
- [x] **2a**: Update `validateAnswerMath` for `true_false` to include `got: ${JSON.stringify(s)}` in error message.
- [x] **2b**: Update `prompts.test.ts` for the new `true_false` error format (expect `got: "yes"` or similar).
- [x] **2c**: Consider adding `got` for `open` (non-null) and `multiple_choice` (non-array) for consistency—lower priority.

---

## Success Criteria

- [x] When validation fails (e.g. `true_false` with `"Oui"`), server logs show: jobId, filename, full error message including received value, and stack trace.
- [x] UI still displays a user-friendly error (unchanged behavior).
- [x] Unit tests pass, including updated `true_false` validation test.

---

## Effort

**Small** — ~30 min. Two files (`route.ts`, `prompts.ts`), one test update.
