# Remove Dead Server-Side Re-exports from Frontend

## Problem

`src/lib/` contains re-export files for server-only core modules that are never imported by any frontend code:

- `src/lib/claude.ts`
- `src/lib/extraction/openaiProvider.ts`
- `src/lib/extraction/anthropicProvider.ts`
- `src/lib/extraction/verifyExplanations.ts`
- `src/lib/extraction/prompts.ts`

Vite currently tree-shakes them out so they don't bloat the bundle, but they're confusing and fragile — any future import would pull in `openai`, `@anthropic-ai/sdk`, `@clerk/backend`, `@aws-sdk/*` into the frontend bundle.

## Verified

- `grep` confirms no frontend source (non-test) imports these files
- Build output confirms 0 occurrences of "openai"/"anthropic" in the JS bundle
- Server code (`functions/`) imports directly from `@math-drill/core`, not through `src/lib/`

## Plan

1. **Delete dead files:**
   - `src/lib/claude.ts`
   - `src/lib/extraction/openaiProvider.ts`
   - `src/lib/extraction/anthropicProvider.ts`
   - `src/lib/extraction/verifyExplanations.ts`
   - `src/lib/extraction/prompts.ts`
   - `src/lib/extraction/verifyExplanations.test.ts` (tests server-only code, should live in core or functions)

2. **Move test if valuable:** `verifyExplanations.test.ts` → `packages/core/src/extraction/verifyExplanations.test.ts` (if not already covered there)

3. **Remove `src/lib/extraction/` directory** if empty after cleanup.

4. **Verify:** `npm run build` still succeeds, `npm test` passes.
