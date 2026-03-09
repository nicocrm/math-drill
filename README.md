# MathDrill

A locally-hosted Next.js web app that ingests math exercise sheets (PDF), extracts exercises via Claude AI, stores them as JSON, and presents them to a single student with interactive answer checking, math rendering, and scoring.

## Project Goal

- **Ingest** PDF exercise sheets via an admin upload page
- **Extract** questions using Claude AI (multiple choice, true/false, numeric/fraction, expression, open)
- **Store** extracted exercises as JSON in `./exercises/`
- **Present** exercises one at a time with KaTeX math rendering
- **Validate** answers using mathjs (fractions, expressions)
- **Score** sessions with per-section breakdown and results review

No database, no auth, no multi-user. Single local process.

## Current Status

### Implemented

| Area | Status |
|------|--------|
| **Project structure** | Next.js 14 App Router, TypeScript, `src/` layout |
| **Types** | Full `ExerciseSet`, `Question`, `Session`, etc. in `types/exercise.ts` |
| **Pages** | `/` (home), `/admin` (upload), `/session/[exerciseId]`, `/results/[sessionId]` |
| **API routes** | `/api/exercises`, `/api/exercises/[id]`, `/api/ingest`, `/api/ingest/status` |
| **Components** | DropZone, IngestionStatus, ExercisePlayer, QuestionRenderer, MathDisplay, PromptDisplay, ScoreBoard, input components |
| **Lib modules** | `claude.ts`, `mathValidation.ts`, `exerciseStore.ts`, `sessionStore.ts` |
| **Dependencies** | @anthropic-ai/sdk, katex, mathjs, react-dropzone, uuid, zod |
| **E2E tests** | Playwright; navigation, home, admin, session, results, API smoke |

### Not Yet Implemented (Stubs / Placeholders)

| Area | Current behavior |
|------|------------------|
| **Ingestion** | POST `/api/ingest` returns mock `jobId`; no PDF handling or Claude extraction |
| **Exercise storage** | `exerciseStore` returns `[]` and `null`; no file I/O |
| **Exercise listing** | Home page shows "No exercise sets yet"; API returns empty array |
| **Exercise player** | Session page shows stub; no question rendering or answer flow |
| **Math rendering** | `MathDisplay` / `PromptDisplay` render plain text; KaTeX not wired |
| **Validation** | `checkFraction` / `checkExpression` return `false`; mathjs not used |
| **Results** | Results page shows stub; no score calculation or review |

## Getting Started

1. Copy `.env.example` to `.env.local` and add your `ANTHROPIC_API_KEY`.
2. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Navigate between Home (`/`) and Upload (`/admin`).

## Running Tests

End-to-end tests use [Playwright](https://playwright.dev/). Run them with:

```bash
npm run test:e2e
```

This command starts the dev server on port 3002 (to avoid conflicts with a running dev instance), runs the E2E test suite in Chromium, and shuts down when complete.

**First-time setup:** Playwright installs Chromium automatically. If you need to install browsers manually:

```bash
npx playwright install chromium
```

**View test report:** After a run, open the HTML report with:

```bash
npx playwright show-report
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for PDF extraction (Claude API) |
| `EXERCISES_DIR` | Path to JSON storage (default: `./exercises`) |
| `INTAKE_DIR` | Path for uploaded PDFs (default: `./intake`) |

## Documentation

- [MathDrill Plan](docs/plans/mathdrill-plan.md) — Full build plan, data model, ingestion flow
- [Initial Scaffolding](docs/plans/initial-scaffolding-subplan.md) — Scaffolding scope and completion criteria
- [E2E Testing](docs/plans/e2e-testing-subplan.md) — Playwright test framework
