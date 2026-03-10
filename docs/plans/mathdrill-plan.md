# MathDrill — Complete Build Plan

> **Purpose:** A locally-hosted Next.js web app that ingests math exercise sheets (PDF),
> extracts exercises via Claude AI, stores them as JSON, and presents them to a single
> student with interactive answer checking, math rendering, and scoring.

---

## 1. Project Structure

The project uses Next.js with a `src/` directory. Path alias `@/*` maps to `./src/*`.

```
math-drill/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Home: list available exercise sets
│   │   ├── globals.css
│   │   ├── admin/
│   │   │   └── page.tsx           # Upload + ingestion status page
│   │   ├── session/
│   │   │   └── [exerciseId]/
│   │   │       └── page.tsx       # Exercise player
│   │   ├── results/
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx       # Score summary
│   │   └── api/
│   │       ├── exercises/
│   │       │   └── route.ts       # GET: list all exercise sets
│   │       ├── exercises/[id]/
│   │       │   └── route.ts       # GET: fetch one exercise set JSON
│   │       ├── ingest/
│   │       │   └── route.ts       # POST: receive PDF, trigger extraction
│   │       └── ingest/status/
│   │           └── route.ts       # GET: SSE stream of ingestion progress
│   ├── components/
│   │   ├── DropZone.tsx           # react-dropzone upload widget
│   │   ├── IngestionStatus.tsx    # SSE-fed live status display
│   │   ├── ExercisePlayer.tsx     # Renders one exercise at a time
│   │   ├── QuestionRenderer.tsx   # Dispatches to the right input type
│   │   ├── inputs/
│   │   │   ├── MultipleChoiceInput.tsx
│   │   │   ├── TrueFalseInput.tsx
│   │   │   ├── FractionInput.tsx  # Accepts "3/5", "-2/3", etc.
│   │   │   └── OpenTextInput.tsx  # For ungraded open questions
│   │   ├── MathDisplay.tsx        # KaTeX wrapper (pure LaTeX)
│   │   ├── PromptDisplay.tsx      # Mixed text + $...$ math renderer
│   │   └── ScoreBoard.tsx         # End-of-session results
│   ├── lib/
│   │   ├── claude.ts              # Anthropic SDK wrapper
│   │   ├── mathValidation.ts      # mathjs-based answer checking
│   │   ├── exerciseStore.ts       # Read/write JSON files from ./exercises/
│   │   └── sessionStore.ts        # localStorage read/write helpers (client-side)
│   └── types/
│       └── exercise.ts            # TypeScript interfaces
├── exercises/                     # Server-side JSON storage (gitignored)
│   └── *.json
├── intake/                        # (optional) staging area for uploaded PDFs
│   └── *.pdf
├── docs/
│   └── plans/
├── package.json
├── next.config.mjs
└── tsconfig.json
```

---

## 2. Data Model

### Exercise Set (`exercises/<id>.json`)

```typescript
// types/exercise.ts

export type QuestionType =
  | "multiple_choice"   // checkbox list, one or more correct answers
  | "true_false"        // exactly one of: "true" | "false"
  | "numeric"           // single fraction or decimal answer
  | "expression"        // multi-step calculation, validated as numeric result (no symbolic equivalence for MVP)
  | "open"              // free text, NOT graded

export interface Choice {
  id: string            // e.g. "a", "b", "c"
  latex: string         // KaTeX-renderable string, e.g. "\\left(\\frac{2}{3}\\right)^2"
}

export interface Question {
  id: string                        // e.g. "q1", "q2a"
  type: QuestionType
  section: string                   // e.g. "C1 - Connaître", "C2 - Appliquer"
  points: number
  prompt: string                    // Mixed text + math using $...$ delimiters, e.g. "Calculer $\\frac{2}{3} + \\frac{1}{4}$"
  choices?: Choice[]                // For multiple_choice only
  answerMath: string | string[] | null
  // Parser-friendly canonical value used for validation:
  //   numeric/expression → mathjs-evaluable string, e.g. "2/3", "(1/2)^3"
  //   multiple_choice    → array of correct choice ids, e.g. ["a", "c"]
  //   true_false          → "true" | "false"
  //   open                → null (not graded)
  answerLatex?: string              // KaTeX display string for the correct answer (used on results page)
  requiresSteps: boolean            // If true, show step input area (not validated)
  // Scoring: open questions must have points: 0 (they are ungraded)
  requiresExample?: boolean         // For true_false: if true, student must provide a counterexample when answering "false"
  hint?: string                     // Optional teacher hint (⚠️ see open questions)
}

export interface ExerciseSet {
  id: string                        // UUID generated at ingestion time
  filename: string                  // Original PDF filename
  title: string                     // Extracted from document, e.g. "Devoir chapitre 7"
  subject: string                   // e.g. "Fractions"
  createdAt: string                 // ISO date string
  sections: {
    id: string                      // e.g. "C1"
    label: string                   // e.g. "Connaître"
    maxPoints: number               // Sum of points for graded questions only (excludes open questions with points: 0)
  }[]
  questions: Question[]
}
```

### Session State (localStorage)

```typescript
export interface SessionAnswer {
  questionId: string
  value: string | string[]          // Student's answer
  isCorrect: boolean | null         // null for open questions
  pointsAwarded: number
  workings?: string                 // Step-by-step working (stored, not validated)
}

export interface Session {
  id: string                        // UUID
  exerciseSetId: string
  startedAt: string
  completedAt?: string
  answers: SessionAnswer[]
}
```

---

## 3. Ingestion Pipeline

### Flow

```
User drops PDF on /admin
  → POST /api/ingest (multipart/form-data)
    → Save PDF to ./intake/<uuid>-<filename>.pdf
    → Return { jobId } immediately
    → Begin background processing:
      → Read PDF as base64
      → Call Claude API with PDF + extraction prompt
      → Parse Claude response as ExerciseSet JSON
      → Validate/sanitize JSON (zod schema)
      → Save to ./exercises/<uuid>.json
      → Mark job status as "done" with exerciseId
  → Client opens EventSource to GET /api/ingest/status?jobId=xxx (SSE)
    → Receives step-by-step progress events
    → On "done" event: redirects to /session/<exerciseId>
    → Fallback: poll GET /api/ingest/status?jobId=xxx every 1s if SSE fails
```

### SSE Implementation Note

Next.js App Router supports streaming responses via `ReadableStream`. The ingest route
should write a `TransformStream` and flush status events as each pipeline step completes.
The client uses `EventSource` pointed at `/api/ingest/status?jobId=xxx`.

> **Assumption: local-only runtime.** Job state is kept in-memory (a `Map<string, JobStatus>`
> in the ingestion module). This is acceptable because the app runs as a single local
> `next dev` / `next start` process — there is no multi-instance deployment, and losing
> job state on a restart is a non-issue (the user simply re-uploads). If reliability
> across restarts is ever required, persist job state to a JSON file alongside the
> exercises store.

If SSE proves unreliable in the local dev environment, fall back to **polling**
(`setInterval` hitting `/api/ingest/status?jobId=xxx` every 1s returning a simple
JSON status object).

### Claude Extraction Prompt

The prompt sent to Claude should:
1. Include the PDF as a base64 document block
2. Instruct Claude to return **only valid JSON** matching the `ExerciseSet` schema
3. Explicitly handle:
   - Providing **two representations** for every answer:
     - `answerMath`: a plain parser-friendly string that mathjs can evaluate (e.g. `"2/3"`, `"(1/2)^3"`)
     - `answerLatex`: a KaTeX-renderable LaTeX string for display (e.g. `"\\frac{2}{3}"`)
   - Prompts use `$...$` delimiters for inline math within plain text, e.g. `"Calculer $\\frac{2}{3} + \\frac{1}{4}$"`
   - `choice.latex` fields are pure KaTeX LaTeX strings (no delimiters needed)
   - Flagging open/ungraded questions (`type: "open"`, `answerMath: null`)
   - Identifying correct answers where deterministic
   - Marking `requiresSteps: true` for questions that ask to show working

```typescript
// lib/claude.ts  (sketch)
const SYSTEM_PROMPT = `
You are a math exercise extractor. Given a scanned exercise sheet,
extract all questions and return ONLY a valid JSON object matching
this schema: <schema>...</schema>.

Rules:
- Prompts use dollar-sign delimiters for inline math: "Calculer $\\frac{2}{3}$"
- Choice latex fields are pure KaTeX LaTeX (no dollar-sign delimiters)
- For every answer, provide BOTH:
  - "answerMath": a plain mathjs-evaluable string (e.g. "2/3", "-2/3", "(1/2)^3")
  - "answerLatex": a KaTeX LaTeX string for display (e.g. "\\frac{2}{3}")
- For multiple_choice, answerMath is an array of correct choice ids
- For open-ended questions (counterexamples, proofs), set type to "open" and answerMath to null
- For true/false questions, if "give a counterexample if false" is required,
  set type to "true_false" with a sub-field requiresExample: true
- Identify point values from the document when present
- Section labels should match the document exactly
`
```

> **Design decision (resolved):** No LaTeX-to-mathjs normalization pass is needed.
> Claude returns both formats at extraction time, so the display pipeline uses
> `answerLatex` and the validation pipeline uses `answerMath` with no conversion.
> At ingestion time, a zod schema + `mathjs.parse()` check validates that
> `answerMath` values are actually evaluable.

---

## 4. Math Rendering

Use **KaTeX** via the `katex` npm package (not `react-katex` which is unmaintained).

```tsx
// components/MathDisplay.tsx  — renders a pure LaTeX string (for choices, answers)
import katex from "katex"
import "katex/dist/katex.min.css"

export function MathDisplay({ latex, block = false }: { latex: string; block?: boolean }) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: block,
  })
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

// components/PromptDisplay.tsx  — renders mixed text + $...$ math (for prompts)
export function PromptDisplay({ text }: { text: string }) {
  const parts = text.split(/\$([^$]+)\$/g)
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 0 ? part : <MathDisplay key={i} latex={part} />
      )}
    </span>
  )
}
```

- `question.prompt` → `<PromptDisplay>` (handles mixed text + `$...$` math)
- `choice.latex`, `answerLatex` → `<MathDisplay>` (pure KaTeX)

---

## 5. Math Validation

Use **mathjs** for answer checking. The `correctAnswer` parameter always comes from
`question.answerMath` (a plain parser-friendly string), never from LaTeX.

```typescript
// lib/mathValidation.ts
import { fraction, equal, parse } from "mathjs"

// For numeric/fraction answers: compare as fractions
export function checkFraction(studentInput: string, correctAnswer: string): boolean {
  try {
    const a = fraction(studentInput.replace("−", "-"))
    const b = fraction(correctAnswer)
    return equal(a, b) as boolean
  } catch {
    return false
  }
}

// For expression answers: both sides must evaluate to a numeric value (no variables).
// Symbolic equivalence is out of scope for MVP.
export function checkExpression(studentInput: string, correctAnswer: string): boolean {
  try {
    const a = parse(studentInput.replace("−", "-")).evaluate()
    const b = parse(correctAnswer).evaluate()
    if (typeof a !== "number" || typeof b !== "number") return false
    return Math.abs(a - b) < 1e-10
  } catch {
    return false
  }
}
```

> **Note:** Because `answerMath` is already in mathjs-evaluable format (guaranteed by
> the ingestion zod + `mathjs.parse()` check), no LaTeX-to-mathjs conversion is needed
> in the validation pipeline.

⚠️ **Open question:** Student input for expressions is hard to validate purely with
mathjs if the student writes things like `3 × 1/2 - (-1/3)` with mixed notation. Options:
- **Strict mode:** require a specific format (e.g. only accept the final reduced fraction)
- **Lenient mode:** pass student input to Claude for semantic equivalence checking
- **Recommendation:** Start with strict mode (final answer only), revisit if needed.

⚠️ **Open question:** For `requiresSteps: true` questions, the step-by-step working field
is displayed and collected but **not validated**. It is shown on the results page for
self-review only. Accept this limitation for now.

---

## 6. Pages & Components

### `/` — Home

- Lists all available exercise sets from `GET /api/exercises`
- Each card shows: title, subject, question count, total points, date added
- "Start" button → `/session/<id>`

### `/admin` — Upload

- `<DropZone>`: accepts PDF only, single file
- On drop: POST to `/api/ingest`, get back a `jobId`
- `<IngestionStatus jobId={jobId}>`: connects to SSE, shows step-by-step progress
- On completion: shows "7 exercises extracted" + link to start session or go home
- On error: shows error message + option to retry

### `/session/[exerciseId]` — Exercise Player

- Loads exercise set from `GET /api/exercises/[id]`
- Initializes a `Session` in localStorage
- Renders questions one at a time (or grouped by section — ⚠️ see open questions)
- Per question:
  - Section badge + points badge
  - `<MathDisplay>` for the prompt
  - Appropriate `<Input>` component based on `question.type`
  - "Open question — not graded" notice for `type: "open"`
  - "Show working" textarea for `requiresSteps: true` (stored but not validated)
  - "Confirm" button → validates answer, shows immediate feedback (✓ / ✗ + correct answer)
  - "Next" button → advance
- Progress bar at top

### `/results/[sessionId]` — Score Summary

- Reads session from localStorage
- Shows overall score + per-section breakdown (matching the document's C1/C2 grid)
  - Scoring policy: open questions (`type: "open"`) have `points: 0` and are excluded
    from `maxPoints`. The displayed max is always the achievable graded total.
- Per-question review: student answer vs correct answer, with math rendering
  - Open questions show the student's response for self-review (no correct/incorrect badge)
- "Try again" (reset session) and "Back to home" buttons

---

## 7. Key Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "typescript": "^5",
    "@anthropic-ai/sdk": "latest",
    "openai": "latest",
    "katex": "^0.16",
    "mathjs": "^13",
    "react-dropzone": "^14",
    "uuid": "^9",
    "zod": "^3"
  }
}
```

Note: `openai` is added when implementing the [Anthropic → OpenAI Migration](./implemented/2025-03-09-anthropic-to-openai-migration.md). Either `@anthropic-ai/sdk` or `openai` is required depending on `EXTRACTION_PROVIDER`.

No database. No auth. No external services beyond the LLM API (Anthropic or OpenAI). See [Anthropic → OpenAI Migration](./implemented/2025-03-09-anthropic-to-openai-migration.md) for provider-switching plan.

---

## 8. Environment Variables

```bash
# .env.local
# Extraction provider: Anthropic (default) or OpenAI
ANTHROPIC_API_KEY=sk-ant-...    # Required when using Anthropic
OPENAI_API_KEY=sk-...           # Required when using OpenAI (see migration plan)
EXERCISES_DIR=./exercises       # Path to JSON storage directory
INTAKE_DIR=./intake             # Path to uploaded PDF staging directory
```

---

## 9. Open Questions Summary

| # | Area | Question | Suggested Default |
|---|------|----------|-------------------|
| 1 | **Ingestion** | If Claude returns malformed JSON, retry automatically or show error to user? | Show error, let user retry |
| 2 | **Ingestion** | Should there be a manual review/edit screen for extracted exercises before they go live? | No for MVP — auto-publish |
| 3 | **Ingestion** | SSE vs polling for ingestion status — SSE preferred but may need fallback | Try SSE, fall back to polling |
| 4 | **Player** | Show questions one-by-one or all at once grouped by section? | One at a time |
| 5 | **Player** | Show correct answer immediately after each question, or only at the end? | Immediately after confirming |
| 6 | **Validation** | For multi-step expression questions, validate final answer only or full working? | Final answer only |
| 7 | **Validation** | Student input format for fractions: free text or structured numerator/denominator fields? | Free text with format hint |
| 8 | **Validation** | For `multiple_choice`, award partial credit per correct checkbox or all-or-nothing? | All-or-nothing per question |
| 9 | **LaTeX** | Post-process Claude's LaTeX output for consistency, or trust it? | **Resolved:** Trust Claude for display (`answerLatex`); validate `answerMath` at ingestion via zod + `mathjs.parse()`. No normalization pass needed. |
| 10 | **Storage** | If `./exercises/` grows large, any cleanup/management needed? | Out of scope for MVP |

---

## 10. Review Problems (Validated + Prioritized)

Scoring rubric:
- `1` = not really a problem for this local MVP
- `2` = moderate/conditional problem
- `3` = real problem

Priority rubric:
- `P0` = fix now before implementation
- `P1` = fix soon (first implementation pass)
- `P2` = backlog/documentation cleanup

| # | Area | Problem | Confirmed? | Score | Priority | Recommended Action |
|---|------|---------|------------|:-----:|:--------:|--------------------|
| 1 | **Data Model vs Prompt** | The schema says `answer` for `numeric`/`expression` should be mathjs-evaluable strings, but the Claude prompt says all math expressions should be LaTeX strings. | ~~Yes~~ **Resolved** | 3 | **P0** | **Done:** `answer` split into `answerMath` (parser-friendly, for validation) and `answerLatex` (KaTeX, for display). Claude prompt updated to produce both. No normalization pass needed. |
| 2 | **True/False Representation** | `QuestionType` comment includes `"example_required"` and prompt introduces `requiresExample`, but neither exists in the `Question` interface. | ~~Partly~~ **Resolved** | 2 | **P1** | **Done:** Added `requiresExample?: boolean` to `Question`; removed `"example_required"` from `QuestionType` comment. |
| 3 | **Ingestion Transport Flow** | Flow says `POST /api/ingest` opens SSE (or polling), while page spec says POST returns `jobId` and client opens `EventSource` to `/api/ingest/status`. | ~~Partly~~ **Resolved** | 2 | **P1** | **Done:** Flow standardized: `POST /api/ingest` returns `{ jobId }` immediately; status via `GET /api/ingest/status?jobId=...` (SSE with polling fallback). |
| 4 | **Session Data Incomplete** | Plan says step-by-step working is "stored but not validated", but `SessionAnswer` has no field for steps/workings. | ~~Yes~~ **Resolved** | 3 | **P0** | **Done:** Added `workings?: string` to `SessionAnswer`. |
| 5 | **Question Rendering Assumption** | Plan says all `question.prompt` strings pass through KaTeX, but model defines prompts as "Plain text or LaTeX". | ~~Yes~~ **Resolved** | 3 | **P0** | **Done:** Prompts use `$...$` delimiters for inline math. New `<PromptDisplay>` component splits on `$...$` and renders math segments via KaTeX, plain text as-is. |
| 6 | **Expression Validation Semantics** | `checkExpression` numerically evaluates both sides and compares floats; this does not test symbolic equivalence and can fail on variable expressions or domain-sensitive cases. | ~~Partly~~ **Resolved** | 2 | **P1** | **Done:** `checkExpression` now explicitly rejects non-numeric results; `expression` type scoped to numeric final answers for MVP. |
| 7 | **Runtime Model Assumptions** | SSE/job state implies long-lived in-memory job tracking, but plan gives no persistence strategy and notes SSE deployment fragility. | ~~No~~ **Resolved** | 1 | **P2** | **Done:** Added explicit local-only runtime assumption; in-memory `Map` is sufficient, with JSON-file fallback noted for future. |
| 8 | **Scoring Rules Gap** | Open questions are ungraded (`answer: null`), but section `maxPoints` includes total points without clarifying if open-question points are excluded. | ~~Partly~~ **Resolved** | 2 | **P1** | **Done:** Open questions must have `points: 0`; `maxPoints` only sums graded questions. Policy documented in data model and results page spec. |
| 9 | **API/File Path Documentation** | Project tree includes `api/ (Next.js route handlers)` and then nested `app/api/...` entries, which is structurally inconsistent for App Router projects. | ~~No~~ **Resolved** | 1 | **P2** | **Done:** Removed extra `api/` wrapper; routes now shown under `app/api/` in the project tree. |

### Implementation Order

All review problems have been resolved in the plan. No outstanding fixes remain.

---

## 11. Sub-Plans

| Sub-Plan | Purpose |
|----------|---------|
| [Initial Scaffolding](./implemented/initial-scaffolding-subplan.md) | Project structure, types, placeholder routes/components |
| [E2E Testing](./implemented/e2e-testing-subplan.md) | Playwright-based end-to-end test framework and test suite |
| [Remainder Implementation](./implemented/2025-03-09-mathdrill-remainder-implementation.md) | Phased plan: ingestion, math rendering/validation, exercise player, home/results, E2E |
| [Anthropic → OpenAI Migration](./implemented/2025-03-09-anthropic-to-openai-migration.md) | Plan for switching PDF extraction from Anthropic to OpenAI API |

---

## 12. Out of Scope (MVP)

- Multi-user / authentication
- Exercise editing UI after ingestion
- Generating *new* exercises (variations) — only replays extracted ones
- Timed sessions
- Teacher dashboard / analytics
- Support for non-PDF formats (images, Word docs)
