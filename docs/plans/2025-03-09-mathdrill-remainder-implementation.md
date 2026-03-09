# MathDrill Remainder Implementation Plan

**Parent**: [mathdrill-plan.md](./mathdrill-plan.md)  
**Date**: 2025-03-09  
**Status**: Draft  
**Sub-plans completed**: [Initial Scaffolding](./implemented/initial-scaffolding-subplan.md), [E2E Testing](./implemented/e2e-testing-subplan.md)

## Overview

This plan implements the remainder of MathDrill after scaffolding and E2E test framework setup. The scaffolding provides: Next.js structure, types, placeholder routes/components, and Playwright tests. This plan delivers: ingestion pipeline (PDF → LLM extraction → JSON), math rendering/validation, exercise player with interactive inputs, results page, and home page exercise listing. The extraction provider is currently Anthropic (Claude); see [Anthropic → OpenAI Migration](./2025-03-09-anthropic-to-openai-migration.md) for switching to OpenAI.

## Current State

### Implemented (Scaffolding Complete)

| Area | Status | File:Line |
|------|--------|-----------|
| Types | Complete | `src/types/exercise.ts` — full interfaces |
| MathDisplay | Complete | `src/components/MathDisplay.tsx` — KaTeX rendering |
| DropZone UI | Partial | `src/components/DropZone.tsx:10` — `onDrop` only logs, no upload |
| ScoreBoard | Complete | `src/components/ScoreBoard.tsx` — accepts score/total/correct props |
| ExercisePlayer | Shell | `src/components/ExercisePlayer.tsx` — renders ScoreBoard + QuestionRenderer |
| API routes | Placeholders | All return mock/empty data |
| Pages | Placeholders | Session/Results show "Not implemented" |
| E2E tests | Scaffolding-ready | `tests/e2e/*.spec.ts` — navigation, home, admin, api-smoke, session, results |

### Stubs (To Implement)

| Module | Current | Target |
|--------|---------|--------|
| `lib/claude.ts` | `throw new Error("Not implemented")` | PDF extraction via Anthropic API |
| `lib/mathValidation.ts` | Always returns `false` | mathjs-based `checkFraction`, `checkExpression` |
| `lib/exerciseStore.ts` | Returns `[]` / `null` | File I/O to `./exercises/*.json` |
| `lib/sessionStore.ts` | No-op | localStorage get/save |
| `PromptDisplay` | Renders text as-is | Parse `$...$` delimiters, render math via MathDisplay |
| `QuestionRenderer` | Hardcoded stub | Dispatch by `question.type`, render prompt + inputs |
| Input components | Static stubs | Accept `question`, `value`, `onChange`, `onConfirm` |
| Home page | Static "No exercise sets" | Fetch and list from `GET /api/exercises` |
| Session page | "Not implemented" | ExercisePlayer with real exercise data |
| Results page | "Not implemented" | ScoreBoard + per-question review from session |
| Ingestion flow | Mock jobId only | PDF upload, Claude extraction, SSE status, redirect |

### Key Discoveries

- **MathDisplay** (`src/components/MathDisplay.tsx`) is fully implemented with KaTeX — no changes needed.
- **FractionInput** plan says "free text with format hint" — single input for `"3/5"`, `"-2/3"`, not separate num/den fields. Current stub has num/den — must change.
- **Session page** is a server component; ExercisePlayer must be client-side for interactivity. Exercise can be fetched client-side in ExercisePlayer or passed from page.
- **Playwright** uses port 3002 (`playwright.config.ts:3`). E2E tests expect `jobId` in ingest/status; ingest/status expects `jobId` query param.
- **No `tests/fixtures/mock-exercise.json`** exists yet — needed for session/results E2E tests.

## Desired End State

1. **Admin**: User drops PDF → POST ingest → SSE status → redirect to `/session/<exerciseId>` on done.
2. **Home**: Lists exercise sets from `GET /api/exercises`; "Start" → `/session/<id>`.
3. **Session**: Loads exercise, one question at a time, with Confirm (validate, show feedback) and Next (advance). On completion → `/results/<sessionId>`.
4. **Results**: Score, per-section breakdown, per-question review (student vs correct), "Try again" and "Back to home".
5. **E2E**: Full flow tests pass (ingestion, session, results) with fixture data.

## What We're NOT Doing

- Multi-user / auth
- Exercise editing UI after ingestion
- Manual review screen before publish
- Symbolic equivalence for expressions (numeric evaluation only)
- Validation of step-by-step working (`requiresSteps` stored, not validated)
- `requiresExample` counterexample validation (collected, not validated)
- Non-PDF formats
- LaTeX-to-mathjs normalization (Claude provides both `answerMath` and `answerLatex`)

## Implementation Approach

Backend-first for ingestion (enables manual testing with real PDFs), then math rendering/validation (shared by player), then input components and QuestionRenderer, then ExercisePlayer and session flow, then Home/Results pages, finally full E2E tests.

## Team Strategy

- **Phase 1 (Ingestion)**: Backend-only. Single developer.
- **Phase 2 (Math)**: Independent. Can run in parallel with Phase 1.
- **Phase 3 (Inputs)**: Depends on Phase 2. Single developer.
- **Phase 4 (Player)**: Depends on Phases 1, 2, 3. Single developer.
- **Phase 5 (Home/Results)**: Depends on Phase 4. Single developer.
- **Phase 6 (E2E)**: Depends on Phase 5. Single developer.

**Parallelizable**: Phase 1 and Phase 2 can run concurrently.  
**Sequential**: Phases 3–6 must run in order.

---

## Phase 1: Ingestion Pipeline

**Assignable to**: backend-dev  
**Depends on**: None

### Overview

Implement PDF upload, Claude extraction, exercise storage, and SSE status streaming. Admin page wires DropZone and IngestionStatus to the real APIs.

### Changes Required

#### 1. Exercise Store

**File**: `src/lib/exerciseStore.ts`  
**Action**: Modify

- Read `EXERCISES_DIR` from `process.env` (default `./exercises`)
- `listExercises()`: async, read directory, parse each `.json`, return `ExerciseSet[]`
- `getExercise(id)`: async, read `./exercises/<id>.json`, parse, return or `null`
- `saveExercise(exercise: ExerciseSet)`: async, write JSON to `./exercises/<id>.json`
- Create `exercises/` directory if missing
- Use `fs/promises` for async I/O

#### 2. Claude Extraction

**File**: `src/lib/claude.ts`  
**Action**: Modify

- `extractExercises(pdfBase64: string, filename: string): Promise<ExerciseSet>`
- Use `@anthropic-ai/sdk` with Claude model (e.g. `claude-sonnet-4-20250514`)
- Send PDF as base64 document block
- System prompt: extract JSON matching `ExerciseSet` schema; `$...$` for prompts; `answerMath` (mathjs-evaluable) + `answerLatex` (KaTeX) for each answer; `type: "open"`, `answerMath: null` for ungraded; `requiresExample` for true/false counterexample
- Parse response as JSON, validate with zod schema
- Validate `answerMath` for numeric/expression via `mathjs.parse()` at ingestion
- Return validated `ExerciseSet` or throw on malformed JSON (no retry — show error to user per open question #1)

#### 3. Zod Schema

**File**: `src/lib/exerciseSchema.ts` (new)  
**Action**: Create

- Zod schema for `ExerciseSet` matching `types/exercise.ts`
- Export `exerciseSetSchema` for validation in claude.ts

#### 4. POST /api/ingest

**File**: `src/app/api/ingest/route.ts`  
**Action**: Modify

- Accept `multipart/form-data` with `file` field
- Validate PDF only (reject other types)
- Generate UUID for job and exercise ID
- Save PDF to `./intake/<uuid>-<filename>.pdf` (use `INTAKE_DIR` env)
- Return `{ jobId }` immediately
- Start background processing: read PDF as base64, call `extractExercises`, validate, `saveExercise`, update job status to `"done"` with `exerciseId`
- On error: set job status to `"error"` with message

#### 5. Job State

**File**: `src/lib/ingestJobs.ts` (new)  
**Action**: Create

- In-memory `Map<string, JobStatus>` where `JobStatus = { status: "pending" | "processing" | "done" | "error", progress?: number, exerciseId?: string, error?: string }`
- `getJob(id)`, `setJob(id, status)`, `updateProgress(id, step)`
- Steps: `saving`, `extracting`, `validating`, `saving_exercise`, `done`

#### 6. GET /api/ingest/status

**File**: `src/app/api/ingest/status/route.ts`  
**Action**: Modify

- Accept `jobId` query param
- Return SSE stream: send events as each step completes (`{ step, progress }`), final `{ status: "done", exerciseId }` or `{ status: "error", error }`
- Fallback: if SSE problematic, support JSON response for polling (`{ status, progress, exerciseId?, error? }`)

#### 7. DropZone

**File**: `src/components/DropZone.tsx`  
**Action**: Modify

- On drop: `POST /api/ingest` with `FormData` containing file
- On success: receive `{ jobId }`, call `onJobStarted?.(jobId)` or lift state to parent
- Admin page must pass `jobId` to IngestionStatus

#### 8. IngestionStatus

**File**: `src/components/IngestionStatus.tsx`  
**Action**: Modify

- Accept `jobId: string` prop
- Connect `EventSource` to `/api/ingest/status?jobId=...`
- Parse SSE events, show step-by-step progress
- On `done`: show "N exercises extracted", link to `/session/<exerciseId>`, optionally `router.push`
- On `error`: show error message, retry option
- Fallback: if EventSource fails, poll every 1s

#### 9. Admin Page

**File**: `src/app/admin/page.tsx`  
**Action**: Modify

- Create client component `AdminUpload` (or inline) with state `jobId: string | null`
- DropZone `onDrop` callback receives file, POSTs to `/api/ingest`, sets jobId from response
- When jobId set, render IngestionStatus with jobId
- Admin page can remain server component that renders client `AdminUpload` wrapper

### Success Criteria

#### Automated Verification

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] E2E: `tests/e2e/admin.spec.ts` passes (Upload heading, DropZone visible)
- [ ] E2E: `tests/e2e/api-smoke.spec.ts` passes

#### Manual Verification

- [ ] Drop PDF on admin → POST returns jobId
- [ ] IngestionStatus shows progress steps
- [ ] On completion, `exercises/<uuid>.json` exists with valid ExerciseSet
- [ ] Redirect or link to `/session/<exerciseId>` works

**PAUSE**: After automated verification passes, confirm manual verification before Phase 4 (Player depends on real exercises).

---

## Phase 2: Math Rendering & Validation

**Assignable to**: any  
**Depends on**: None

### Overview

Implement `$...$` parsing in PromptDisplay and mathjs-based validation in mathValidation.ts.

### Changes Required

#### 1. PromptDisplay

**File**: `src/components/PromptDisplay.tsx`  
**Action**: Modify

- Split `text` on `$([^$]+)$` (regex)
- Odd-indexed segments = math, render via `<MathDisplay key={i} latex={part} />`
- Even-indexed = plain text
- Handle edge case: unmatched `$` (render as literal or skip)

#### 2. mathValidation

**File**: `src/lib/mathValidation.ts`  
**Action**: Modify

- `checkFraction(studentInput, correctAnswer)`: use `mathjs.fraction()` and `mathjs.equal()`; normalize `−` to `-`
- `checkExpression(studentInput, correctAnswer)`: `mathjs.parse().evaluate()` both; compare numerically with `Math.abs(a - b) < 1e-10`; reject non-numeric
- Add `checkMultipleChoice(studentAnswer: string[], correctAnswer: string[]): boolean` — all-or-nothing, order-independent
- Add `checkTrueFalse(studentAnswer: string, correctAnswer: string): boolean` — exact match `"true"` or `"false"`

### Success Criteria

#### Automated Verification

- [ ] `npm run build` passes
- [ ] Unit tests (if added): `checkFraction("2/3", "2/3")` → true, `checkFraction("4/6", "2/3")` → true (if mathjs normalizes)
- [ ] Manual: PromptDisplay with `"Calculate $\\frac{1}{2}$"` renders fraction

#### Manual Verification

- [ ] PromptDisplay renders mixed text + math correctly
- [ ] checkFraction, checkExpression return correct results for sample inputs

**PAUSE**: Confirm before Phase 3.

---

## Phase 3: Input Components & QuestionRenderer

**Assignable to**: frontend-dev  
**Depends on**: Phase 2

### Overview

Implement each input component to accept question props and callbacks; implement QuestionRenderer to dispatch by type and render prompt/section/points.

### Changes Required

#### 1. Input Component Interface

All inputs accept:

- `question: Question`
- `value: string | string[]`
- `onChange: (value: string | string[]) => void`
- `onConfirm: () => void`
- `disabled?: boolean` (after confirm)
- `showFeedback?: boolean` (after confirm: correct/incorrect, correct answer)

#### 2. FractionInput

**File**: `src/components/inputs/FractionInput.tsx`  
**Action**: Modify

- **Single text input** (per plan: "free text with format hint")
- Placeholder: `"e.g. 3/5, -2/3"`
- For `numeric` and `expression` types
- On confirm: call `onConfirm()` with current value

#### 3. MultipleChoiceInput

**File**: `src/components/inputs/MultipleChoiceInput.tsx`  
**Action**: Modify

- Render `question.choices` with `MathDisplay` for each `choice.latex`
- Checkbox or toggle buttons; `value` is `string[]` (selected choice ids)
- All-or-nothing scoring per plan

#### 4. TrueFalseInput

**File**: `src/components/inputs/TrueFalseInput.tsx`  
**Action**: Modify

- Two buttons: True, False
- `value` is `"true"` or `"false"`
- If `requiresExample`: show textarea for counterexample when "false" selected (stored in workings, not validated)

#### 5. OpenTextInput

**File**: `src/components/inputs/OpenTextInput.tsx`  
**Action**: Modify

- Text input/textarea for free text
- No validation; `onConfirm` still called to advance
- Show "Open question — not graded" notice

#### 6. QuestionRenderer

**File**: `src/components/QuestionRenderer.tsx`  
**Action**: Modify

- Accept `question: Question`, `answer: SessionAnswer | undefined`, `onAnswerChange`, `onConfirm`, `disabled`
- Render: section badge, points badge, `<PromptDisplay text={question.prompt} />`
- If `question.type === "open"`: show ungraded notice
- If `requiresSteps`: show "Show working" textarea, store in `workings`
- Dispatch to correct input by `question.type`
- Render feedback after confirm: ✓/✗, correct answer via `MathDisplay` when `answerLatex`

### Success Criteria

#### Automated Verification

- [ ] `npm run build` passes
- [ ] Components render without errors when passed mock question

#### Manual Verification

- [ ] Each input type renders correctly with sample question
- [ ] Confirm triggers onConfirm; feedback displays

**PAUSE**: Confirm before Phase 4.

---

## Phase 4: Exercise Player & Session Flow

**Assignable to**: frontend-dev  
**Depends on**: Phase 1, Phase 2, Phase 3

### Overview

Wire sessionStore, ExercisePlayer, and session page. Load exercise from API, manage session state, validate answers, advance questions, redirect to results on completion.

### Changes Required

#### 1. sessionStore

**File**: `src/lib/sessionStore.ts`  
**Action**: Modify

- `getSession(id: string): Session | null` — `localStorage.getItem(`session-${id}`)`, parse JSON
- `saveSession(session: Session): void` — `localStorage.setItem(`session-${session.id}`, JSON.stringify(session))`
- Client-only: use `typeof window !== "undefined"` guard or call from client components only

#### 2. GET /api/exercises

**File**: `src/app/api/exercises/route.ts`  
**Action**: Modify

- Call `listExercises()` from exerciseStore
- Return `{ exercises: ExerciseSet[] }` (minimal: id, filename, title, subject, createdAt, question count, total points)

#### 3. GET /api/exercises/[id]

**File**: `src/app/api/exercises/[id]/route.ts`  
**Action**: Modify

- Call `getExercise(id)` from exerciseStore
- Return full ExerciseSet or 404

#### 4. ExercisePlayer

**File**: `src/components/ExercisePlayer.tsx`  
**Action**: Modify

- Accept `exerciseId: string` prop
- Fetch `GET /api/exercises/${exerciseId}` on mount
- Initialize or load session: `getSession` by exerciseId or create new with `uuid`
- State: `currentIndex`, `answers: SessionAnswer[]`
- Render: progress bar, current question via QuestionRenderer
- On Confirm: validate via mathValidation, update answers, show feedback
- On Next: advance; if last question, set `completedAt`, `saveSession`, `router.push(/results/${session.id})`
- Pass exercise, current question, answer, callbacks to QuestionRenderer

#### 5. Session Page

**File**: `src/app/session/[exerciseId]/page.tsx`  
**Action**: Modify

- Render `ExercisePlayer exerciseId={exerciseId} />` (client component)
- If exercise not found (404), show error and link home
- Remove "Not implemented" placeholder

### Success Criteria

#### Automated Verification

- [ ] `npm run build` passes
- [ ] E2E: session.spec.ts — update to expect ExercisePlayer UI when exercise exists (or keep placeholder test for invalid ID)

#### Manual Verification

- [ ] Navigate to `/session/<valid-id>` with exercise in exercises/ → loads, shows first question
- [ ] Answer, confirm, see feedback; next advances
- [ ] Complete all questions → redirect to results

**PAUSE**: Confirm before Phase 5.

---

## Phase 5: Home Page & Results Page

**Assignable to**: frontend-dev  
**Depends on**: Phase 4

### Overview

Home page lists exercises from API; Results page shows score and per-question review from session.

### Changes Required

#### 1. Home Page

**File**: `src/app/page.tsx`  
**Action**: Modify

- Call `listExercises()` from exerciseStore (server-side) or fetch `GET /api/exercises` (client)
- If empty: show "No exercise sets yet" + link to admin
- If not empty: cards with title, subject, question count, total points, date; "Start" → `/session/<id>`

#### 2. Results Page

**File**: `src/app/results/[sessionId]/page.tsx`  
**Action**: Modify

- Client component or client child: load session from `sessionStore.getSession(sessionId)`
- If not found: show "Session not found", link home
- Render ScoreBoard with score, total, correct, totalQuestions from session
- Per-section breakdown (from exercise sections, aggregate points)
- Per-question review: prompt, student answer, correct answer (with MathDisplay), ✓/✗ badge (or none for open)
- "Try again" → clear session or reset, redirect to `/session/<exerciseId>`
- "Back to home" → `/`

### Success Criteria

#### Automated Verification

- [ ] `npm run build` passes
- [ ] E2E: home.spec.ts — update if home shows exercise cards when data exists; keep empty-state test
- [ ] E2E: results.spec.ts — update to expect ScoreBoard when session exists

#### Manual Verification

- [ ] Home lists exercises when exercises/ has files
- [ ] Results shows score, breakdown, per-question review
- [ ] Try again and Back to home work

**PAUSE**: Confirm before Phase 6.

---

## Phase 6: E2E Tests (Full Flow)

**Assignable to**: any  
**Depends on**: Phase 5

### Overview

Add mock exercise fixture, extend E2E tests for ingestion, session, and results flows.

### Changes Required

#### 1. Mock Fixture

**File**: `tests/fixtures/mock-exercise.json`  
**Action**: Create

- Minimal valid ExerciseSet: one question per type (multiple_choice, true_false, numeric, expression, open)
- Use for seeding exercises/ or mocking API in tests

#### 2. Ingestion E2E

**File**: `tests/e2e/admin.spec.ts`  
**Action**: Extend

- Add test: upload fixture PDF, poll/SSE until done, assert redirect or link to session
- Create `tests/fixtures/sample.pdf` (minimal valid PDF, e.g. single page with "Test" text) or skip ingestion E2E if fixture creation is impractical

#### 3. Session E2E

**File**: `tests/e2e/session.spec.ts`  
**Action**: Extend

- Seed exercises/ with mock-exercise.json (or mock API)
- Navigate to session, fill answers, submit, advance, verify redirect to results

#### 4. Results E2E

**File**: `tests/e2e/results.spec.ts`  
**Action**: Extend

- Seed localStorage with session (or complete session flow first)
- Verify score, section breakdown, per-question review, buttons

#### 5. CI Considerations

- Ensure `EXERCISES_DIR` and `INTAKE_DIR` point to temp dirs in CI
- Playwright webServer starts `next dev`; ensure env vars available

### Success Criteria

#### Automated Verification

- [ ] `npm run test:e2e` passes
- [ ] All E2E tests pass in CI (if configured)

#### Manual Verification

- [ ] Full flow: upload PDF → session → results works end-to-end

---

## Testing Strategy

### Backend

- exerciseStore: consider unit tests for list/get/save with temp dir
- mathValidation: unit tests for checkFraction, checkExpression, checkMultipleChoice, checkTrueFalse
- Extraction provider (Claude/OpenAI): integration test with fixture PDF (optional, may require API key)

### Frontend

- Component tests for inputs with mock question (optional)
- E2E covers main flows

### Manual

1. Upload real PDF → verify extraction
2. Complete session → verify scoring
3. Results page → verify per-question review

## Project-Specific Checklists

- [ ] No database — file-based storage only
- [ ] No auth — single-user local app
- [ ] Env: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (per [migration plan](./2025-03-09-anthropic-to-openai-migration.md)), `EXERCISES_DIR`, `INTAKE_DIR`
- [ ] `exercises/` and `intake/` gitignored

## Migration Notes

- No existing data to migrate
- Rollback: remove new JSON files from exercises/ if needed

## References

- Main plan: `docs/plans/mathdrill-plan.md`
- Initial scaffolding: `docs/plans/implemented/initial-scaffolding-subplan.md`
- E2E testing: `docs/plans/implemented/e2e-testing-subplan.md`
- [Anthropic → OpenAI Migration](./2025-03-09-anthropic-to-openai-migration.md) — plan for switching extraction provider
