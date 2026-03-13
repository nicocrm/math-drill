# MathDrill

A Next.js web app that ingests math exercise sheets (PDF), generates fresh exercises via AI (Claude or GPT-4o), and presents them to students with interactive answer checking, KaTeX math rendering, and scoring.

## Features

- **PDF ingestion** — Upload a PDF exercise sheet; AI generates new questions inspired by it (not verbatim copies)
- **AI providers** — Anthropic Claude (`claude-sonnet-4-20250514`) or OpenAI (`gpt-4o`)
- **Concept explanations** — AI generates per-question explanations, fact-checked via a second AI call to remove hallucinations
- **Math rendering** — KaTeX for inline and block math in prompts, choices, and answers
- **Answer validation** — Client-side checking via mathjs (fractions, expressions, multiple choice, true/false)
- **Scoring** — Live score during session, per-section breakdown and full question review on results page
- **Authentication** — Clerk (sign-in modal, per-user exercise ownership, API-level auth on uploads/deletes)
- **Storage** — Flat-file JSON on disk (no database)

## Question Types

Multiple choice, true/false, numeric/fraction, expression, and open (ungraded).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — lists exercise sets with title, subject, question count, points |
| `/admin` | Upload PDF, view/delete your exercises |
| `/session/[exerciseId]` | Interactive drill — one question at a time with live score and progress |
| `/results/[sessionId]` | Score breakdown by section, per-question review with correct answers and explanations |

## API Routes

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/exercises` | No | List all exercises (`?mine=1` requires auth) |
| `GET /api/exercises/[id]` | No | Get single exercise |
| `DELETE /api/exercises/[id]` | Yes | Delete exercise (owner only) |
| `POST /api/ingest` | Yes | Upload PDF, starts async extraction job |
| `GET /api/ingest/status?jobId=...` | No | Poll job progress (JSON or SSE) |

## Getting Started

1. Copy `.env.example` to `.env.local` and configure your API key(s).
2. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXTRACTION_PROVIDER` | `anthropic` | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | — | Required when provider is `anthropic` |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `VERIFY_EXPLANATIONS` | `true` | Set `false` to skip explanation fact-checking |
| `EXERCISES_DIR` | `./exercises` | Path for saved exercise JSON files |
| `INTAKE_DIR` | `./intake` | Path for uploaded PDFs |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | — | Clerk publishable key (optional in dev — keyless mode works) |
| `CLERK_SECRET_KEY` | — | Clerk secret key (optional in dev) |

## Running Tests

```bash
npm run test:e2e    # Playwright E2E tests (Chromium, port 3002)
npm run test        # Vitest unit tests
```

First-time Playwright setup:

```bash
npx playwright install chromium
```

## Architecture Notes

- **Sessions are client-side only** — stored in `localStorage`, no server persistence
- **Ingest jobs are in-memory** — lost on server restart, not suited for multi-process/serverless as-is
- **Auth is API-level** — no middleware route protection; `/admin` page is accessible without login but upload will 401
- **AI generates original questions** — the system prompt instructs the AI to create fresh exercises inspired by the PDF, not extract verbatim content

## Tech Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Clerk, KaTeX, mathjs, Zod, Playwright, Vitest
