# Anthropic → OpenAI API Migration Plan

**Parent**: [mathdrill-plan.md](../mathdrill-plan.md)  
**Date**: 2025-03-09  
**Status**: Implemented

## Overview

This plan describes how to switch the PDF extraction API from Anthropic (Claude) to OpenAI. The extraction logic lives in `src/lib/claude.ts` and is invoked by `src/app/api/ingest/route.ts`. The migration introduces a provider abstraction so both providers can coexist during transition.

---

## Current State

**Single integration point:** `src/lib/claude.ts` → `extractExercises(pdfBase64, filename)`

**Current flow:**
1. PDF uploaded → base64
2. Anthropic Messages API with `type: "document"` (native PDF)
3. System + user prompt → structured JSON
4. Parse, validate with Zod, `validateAnswerMath()`

**API usage:**
- Model: `claude-sonnet-4-20250514`
- `max_tokens: 8192`
- System prompt + user message with document + text
- Response: `response.content` array → first `text` block

---

## Migration Plan

### Phase 1: Add Abstraction Layer (Recommended First)

1. **Introduce extraction provider interface** in `src/lib/extractExercises.ts` (or similar):
   - `extractExercises(pdfBase64, filename): Promise<ExerciseSet>`
   - Implementations: `anthropicProvider.ts`, `openaiProvider.ts`
2. **Use env/config** to select provider (e.g. `EXTRACTION_PROVIDER=openai|anthropic`).
3. **Keep existing Anthropic implementation** as default during migration.

### Phase 2: Implement OpenAI Provider

1. **Install SDK:** `npm install openai`
2. **Choose API:**
   - **Responses API** (`client.responses.create()`): Documented for PDFs, `input_file` with base64.
   - **Chat Completions API** (`client.chat.completions.create()`): Supports `file` content part; verify PDF support for target model.
3. **Map request:**
   - System prompt → `developer` or `system` message
   - User content → `input_file` (base64) + `input_text` (or equivalent)
   - Base64 format: `data:application/pdf;base64,{base64String}` (Responses API)
4. **Map response:**
   - Responses API: `response.output_text` or equivalent
   - Chat Completions: `response.choices[0].message.content`
5. **Reuse** existing JSON parsing, Zod validation, and `validateAnswerMath()`.

### Phase 3: Config and Env

1. **Env:** `OPENAI_API_KEY` (and optionally keep `ANTHROPIC_API_KEY` for fallback).
2. **Update** `.env.example`, README, docs.
3. **Update** `api/ingest/route.ts` to use the abstraction (no direct `claude` import).

### Phase 4: Testing and Validation

1. **Fixture PDFs:** Run extraction with both providers and compare outputs.
2. **E2E:** Ensure ingest flow works with OpenAI.
3. **Optional:** Integration tests with fixture PDFs (may need API keys or mocks).

---

## Capability Differences and Risks

### 1. PDF Input (Main Difference)

| Aspect | Anthropic | OpenAI |
|--------|-----------|--------|
| PDF support | Native `document` block | Vision models: text + page images |
| API | Messages API | Responses API or Chat Completions with `input_file` |
| Format | `type: "document"`, base64 | `input_file` with `file_data` (base64) or `file_id` |

**Risk:** OpenAI’s PDF handling may differ (e.g. layout, math, diagrams). Validate extraction quality on real PDFs.

### 2. Response Format

- **Anthropic:** `response.content` array; text in first `text` block.
- **OpenAI:** `response.output_text` (Responses) or `choices[0].message.content` (Chat).

**Risk:** Low. Only parsing logic changes.

### 3. JSON Output

- Both can return raw JSON.
- OpenAI supports JSON mode / structured outputs; can reduce malformed JSON.

**Risk:** Low; may improve reliability.

### 4. Model Choice

- Anthropic: `claude-sonnet-4-20250514`
- OpenAI: `gpt-4o`, `gpt-4.1`, `gpt-4o-mini`, etc. (vision-capable)

**Risk:** Quality may differ. Run side-by-side on representative PDFs.

### 5. Context and Token Limits

- Claude Sonnet 4: 200k context.
- GPT-4o: 128k; GPT-4o-mini: 128k.

**Risk:** Low for typical worksheets; only for very large PDFs.

### 6. Math and LaTeX

- Both can produce LaTeX and math.
- Extraction quality may differ; `answerMath` and `answerLatex` should still be validated by existing logic.

**Risk:** Medium. Validate on math-heavy PDFs.

### 7. Future “Lenient Mode”

Docs mention “pass student input to Claude for semantic equivalence checking.” If you add this:

- Both providers can do semantic comparison.
- Behavior may differ; would need evaluation.

**Risk:** Low for current scope; relevant only when that feature is implemented.

---

## Summary of Expected Issues

| Issue | Severity | Mitigation |
|-------|----------|------------|
| PDF extraction quality | Medium | A/B test on real PDFs; tune prompts if needed |
| API shape differences | Low | Abstraction layer isolates changes |
| Model quality differences | Medium | Compare outputs; adjust model or prompts |
| Cost/rate limits | Low | Monitor usage and limits |
| JSON schema compliance | Low | Consider OpenAI structured output; keep Zod validation |

---

## Recommended Approach

1. Add the abstraction layer first.
2. Implement OpenAI provider using the Responses API (or Chat Completions if PDF support is confirmed).
3. Run both providers in parallel on a set of fixture PDFs and compare.
4. Switch default to OpenAI once quality is acceptable.
5. Keep Anthropic as an optional fallback if useful.

---

## Implementation Summary

| Item | Location |
|------|----------|
| Abstraction | `src/lib/extractExercises.ts` — delegates by `EXTRACTION_PROVIDER` |
| Shared prompts/validation | `src/lib/extraction/prompts.ts` |
| Anthropic provider | `src/lib/extraction/anthropicProvider.ts` |
| OpenAI provider | `src/lib/extraction/openaiProvider.ts` (Responses API, `gpt-4o`) |
| Backward compat | `src/lib/claude.ts` re-exports `extractExercises` |

**Usage:** Set `EXTRACTION_PROVIDER=openai` and `OPENAI_API_KEY` to use OpenAI. Default remains Anthropic.

---

## References

- Main plan: [mathdrill-plan.md](../mathdrill-plan.md)
- Remainder implementation: [2025-03-09-mathdrill-remainder-implementation.md](./2025-03-09-mathdrill-remainder-implementation.md)
- Extraction entry: `src/lib/extractExercises.ts`
- Ingest route: `src/app/api/ingest/route.ts`
