# Sub-Plan: Initial Scaffolding

> **Parent:** [mathdrill-plan.md](./mathdrill-plan.md)  
> **Purpose:** Establish the minimal Next.js project structure, types, config, and placeholder routes/components so that feature work (ingestion, exercise player, etc.) can proceed without structural churn.

---

## Scope

**In scope:**
- Next.js 14 App Router project with TypeScript
- Directory structure matching the main plan
- Core type definitions
- Placeholder pages and API routes (return mock/empty data)
- Stub components (render minimal UI)
- Dependencies installed
- Environment variable template

**Out of scope:**
- Real ingestion logic, Claude integration, or PDF handling
- Real exercise storage or session persistence
- Math rendering (KaTeX), validation (mathjs), or interactive inputs
- Styling beyond minimal layout (Tailwind or plain CSS)

---

## Prerequisites

- Node.js 18+
- npm or pnpm

---

## Steps

### 1. Initialize Next.js Project

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

- Use `.` to create in current directory (MathDrill root)
- Do **not** add `turbopack` if prompted (optional, can add later)
- This creates `app/`, `public/`, `next.config.js`, `tsconfig.json`, `package.json`, `.eslintrc.json`

**Adjustments after init:**
- Set `package.json` `"name"` to `"math-drill"` (npm convention: lowercase, hyphen-separated; no uppercase)
- Add `exercises/` and `intake/` to `.gitignore` (they are server-side storage)
- Ensure `app/` layout matches plan (see Step 2)

---

### 2. Create Directory Structure

Create the following directories and placeholder files so the structure exists:

```
app/
├── layout.tsx              (already exists from create-next-app)
├── page.tsx                 (replace with minimal home placeholder)
├── admin/
│   └── page.tsx             (create)
├── session/
│   └── [exerciseId]/
│       └── page.tsx         (create)
├── results/
│   └── [sessionId]/
│       └── page.tsx         (create)
└── api/
    ├── exercises/
    │   └── route.ts         (create)
    ├── exercises/[id]/
    │   └── route.ts         (create)
    ├── ingest/
    │   └── route.ts         (create)
    └── ingest/status/
        └── route.ts         (create)

components/                  (create directory)
lib/                         (create directory)
types/                       (create directory)
exercises/                   (create, gitignored)
intake/                      (create, gitignored)
```

---

### 3. Add Type Definitions

Create `types/exercise.ts` with the full interfaces from the main plan (Section 2):

- `QuestionType`
- `Choice`
- `Question`
- `ExerciseSet`
- `SessionAnswer`
- `Session`

Export all types. No logic, only interfaces/types.

---

### 4. Install Additional Dependencies

Add dependencies that will be used later (avoids surprises during feature work):

```bash
npm install @anthropic-ai/sdk katex mathjs react-dropzone uuid zod
npm install -D @types/katex  # if needed
```

Do **not** wire them into components yet; just ensure they are in `package.json`.

---

### 5. Create Environment Template

Create `.env.example`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
EXERCISES_DIR=./exercises
INTAKE_DIR=./intake
```

Create `.env.local` from `.env.example` (or document that the user must copy it). Add `.env.local` to `.gitignore` if not already.

---

### 6. Implement Placeholder API Routes

Each route returns minimal valid responses:

| Route | Method | Response |
|-------|--------|----------|
| `/api/exercises` | GET | `{ exercises: [] }` |
| `/api/exercises/[id]` | GET | `404` or a single mock `ExerciseSet` JSON |
| `/api/ingest` | POST | `{ jobId: "mock-job-123" }` (no file handling) |
| `/api/ingest/status` | GET | `{ status: "pending", progress: 0 }` (no SSE yet) |

Use `NextResponse.json()` for all. No file I/O, no Claude calls.

---

### 7. Implement Placeholder Pages

| Page | Content |
|------|---------|
| `/` | "MathDrill" heading, "No exercise sets yet" message, link to `/admin` |
| `/admin` | "Upload" heading, placeholder for future DropZone |
| `/session/[exerciseId]` | "Exercise session" heading, `exerciseId` from params, "Not implemented" |
| `/results/[sessionId]` | "Results" heading, `sessionId` from params, "Not implemented" |

Use Next.js `Link` for navigation between `/` and `/admin`. No styling beyond default Tailwind if present.

---

### 8. Create Stub Components

Create empty or minimal components so imports resolve:

| Component | Location | Content |
|-----------|----------|---------|
| `DropZone` | `components/DropZone.tsx` | `<div>Drop PDF here (stub)</div>` |
| `IngestionStatus` | `components/IngestionStatus.tsx` | `<div>Ingestion status (stub)</div>` |
| `ExercisePlayer` | `components/ExercisePlayer.tsx` | `<div>Exercise player (stub)</div>` |
| `QuestionRenderer` | `components/QuestionRenderer.tsx` | `<div>Question (stub)</div>` |
| `MathDisplay` | `components/MathDisplay.tsx` | `<span>{latex}</span>` (no KaTeX yet) |
| `PromptDisplay` | `components/PromptDisplay.tsx` | `<span>{text}</span>` (no math parsing) |
| `ScoreBoard` | `components/ScoreBoard.tsx` | `<div>Score (stub)</div>` |

Create `components/inputs/` directory with stubs:

- `MultipleChoiceInput.tsx` → `<div>Multiple choice (stub)</div>`
- `TrueFalseInput.tsx` → `<div>True/False (stub)</div>`
- `FractionInput.tsx` → `<div>Fraction (stub)</div>`
- `OpenTextInput.tsx` → `<div>Open text (stub)</div>`

---

### 9. Create Stub Lib Modules

Create placeholder modules so imports don’t break:

| Module | Content |
|--------|---------|
| `lib/claude.ts` | Export empty object or `export async function extractExercises() { throw new Error("Not implemented") }` |
| `lib/mathValidation.ts` | Export `checkFraction` and `checkExpression` as stub functions returning `false` |
| `lib/exerciseStore.ts` | Export `listExercises()` → `[]`, `getExercise(id)` → `null` |
| `lib/sessionStore.ts` | Export `getSession()`, `saveSession()` as no-op or localStorage stubs |

---

### 10. Verify Build and Run

```bash
npm run build
npm run dev
```

- Build must succeed with no TypeScript errors
- Dev server must start
- Navigate to `/`, `/admin`, `/session/foo`, `/results/bar` — all should render without errors
- `/api/exercises` and `/api/ingest/status` should return valid JSON

---

## Completion Criteria

- [ ] `package.json` `"name"` is `"math-drill"` (npm convention)
- [ ] `npm run build` passes
- [ ] `npm run dev` starts without errors
- [ ] All routes in the project structure exist (pages + API)
- [ ] All stub components and lib modules exist and are importable
- [ ] Types in `types/exercise.ts` match the main plan
- [ ] `.env.example` exists; `.env.local` is gitignored
- [ ] `exercises/` and `intake/` directories exist and are gitignored

---

## Follow-On Work (Not This Sub-Plan)

After scaffolding is complete, feature work can proceed in parallel or in sequence:

1. **Ingestion pipeline** — wire `/api/ingest`, file handling, Claude, `exerciseStore`
2. **Exercise player** — wire `ExercisePlayer`, `QuestionRenderer`, input components, `sessionStore`
3. **Math rendering** — wire KaTeX in `MathDisplay` and `PromptDisplay`
4. **Validation** — implement `mathValidation.ts` with mathjs
5. **Results page** — wire `ScoreBoard`, session read from localStorage

---

## Estimated Effort

~1–2 hours for an experienced developer familiar with Next.js App Router.
