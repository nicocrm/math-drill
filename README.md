# MathDrill

A Vite + React web app that ingests math exercise sheets (PDF), generates fresh exercises via AI (Claude or GPT-4o), and presents them to students with interactive answer checking, KaTeX math rendering, and scoring.

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
| `/session?id=...` | Interactive drill — one question at a time with live score and progress |
| `/results?id=...` | Score breakdown by section, per-question review with correct answers and explanations |

## API Routes

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/exercises` | No | List all exercises (`?mine=1` requires auth) |
| `GET /api/exercises/[id]` | No | Get single exercise |
| `DELETE /api/exercises/[id]` | Yes | Delete exercise (owner only) |
| `POST /api/ingest` | Yes | Upload PDF, starts async extraction job |
| `GET /api/ingest/status?jobId=...` | No | Poll job progress (JSON or SSE) |

## Getting Started

1. Copy `.env.example` to `.env` and configure your API key(s).
2. Install and run:

```bash
npm install
npm run dev
```

This starts the Vite dev server (UI) and the API dev server. Open [http://localhost:3000](http://localhost:3000).

**PDF ingestion:** For PDF uploads to work locally, run the ingest worker in a second terminal:

```bash
npm run dev:worker
```

The dev server is configured with `INGEST_WORKER_URL=http://localhost:3002` so post-ingest will trigger the worker via HTTP.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXTRACTION_PROVIDER` | `anthropic` | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | — | Required when provider is `anthropic` |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `VERIFY_EXPLANATIONS` | `true` | Set `false` to skip explanation fact-checking |
| `EXERCISES_DIR` | `./exercises` | Path for saved exercise JSON files |
| `INTAKE_DIR` | `./intake` | Path for uploaded PDFs |
| `VITE_CLERK_PUBLISHABLE_KEY` | — | Clerk publishable key (optional in dev — keyless mode works) |
| `CLERK_SECRET_KEY` | — | Clerk secret key (optional in dev) |
| `VITE_API_URL` | — | API base URL for unified mode (local dev, static build preview) |
| `VITE_GET_EXERCISES_URL` | — | List exercises (production — Scaleway function URL) |
| `VITE_GET_EXERCISE_URL` | — | Get single exercise (production) |
| `VITE_DELETE_EXERCISE_URL` | — | Delete exercise (production) |
| `VITE_POST_INGEST_URL` | — | Upload PDF / start ingest (production) |
| `VITE_GET_INGEST_STATUS_URL` | — | Poll ingest job status (production) |
| `INGEST_WORKER_URL` | — | Worker URL for local dev (default: http://localhost:3002 when running dev) |
| `INGEST_WORKER_PORT` | `3002` | Port for dev-worker HTTP server |

## Running Tests

```bash
npm run test        # Vitest unit tests
npm run test:e2e    # Playwright E2E tests (Chromium, port 3002)
npm run test:integration   # Integration tests
```

First-time Playwright setup:

```bash
npx playwright install chromium
```

## Testing the Static Build Locally

To serve the production build locally (e.g. to verify deployment artifacts):

```bash
npm run build
npm run preview
```

This serves the built files from `dist/` at [http://localhost:4173](http://localhost:4173).

**With API:** The static build needs `VITE_API_URL` to reach the backend. Without it, API calls use relative paths that `vite preview` does not proxy, so they will 404. To test with the local API:

1. Build with the API URL:
   ```bash
   VITE_API_URL=http://localhost:3001 npm run build
   ```

2. In one terminal, start the API server:
   ```bash
   npm run dev:api
   ```

3. In another terminal, serve the static build:
   ```bash
   npm run preview
   ```

Open [http://localhost:4173](http://localhost:4173); the frontend will call the API at http://localhost:3001.

## Deployment (Terraform)

The backend API and ingest pipeline can be deployed to **Scaleway** using Terraform. The configuration provisions:

- **Object Storage (S3-compatible)** — bucket for exercise JSON files, uploaded PDFs, and job status; lifecycle rules expire `status/` and `intake/` after 48h
- **SQS** — message queue for ingest jobs; triggers the ingest worker when a job is enqueued
- **Serverless Functions** — HTTP endpoints for exercises CRUD, ingest, and ingest status; plus a private SQS-triggered ingest worker

### Prerequisites

- [Terraform](https://www.terraform.io/downloads) (1.0+)
- [Scaleway account](https://www.scaleway.com/) and [API credentials](https://www.scaleway.com/en/docs/iam/api-keys/)
- GNU Make and `zip` (for building function bundles)

### Terraform Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `clerk_secret_key` | Yes | — | Clerk secret key for JWT verification |
| `anthropic_api_key` | No | `""` | Anthropic API key (if using Anthropic provider) |
| `openai_api_key` | Yes | — | OpenAI API key for AI extraction |
| `region` | No | `fr-par` | Scaleway region |
| `s3_bucket` | No | `math-drill-exercises` | Object Storage bucket name |

Provide variables via `terraform.tfvars`, `-var` flags, or environment variables (`TF_VAR_*`).

### Deploy Infrastructure

```bash
make                # build function zips
cd terraform
terraform init
terraform plan -var="clerk_secret_key=..." -var="openai_api_key=..."
terraform apply
```

After `apply`, Terraform outputs the function URLs. For production, build the frontend with the five endpoint-specific env vars set from Terraform outputs:

```bash
make build-frontend
```

This runs `terraform -chdir=terraform output -raw` for each URL and passes them to `npm run build`.

### Terraform Outputs

| Output | Description |
|--------|-------------|
| `get_exercises_url` | URL for listing exercises |
| `get_exercise_url` | URL for fetching a single exercise |
| `delete_exercise_url` | URL for deleting an exercise |
| `post_ingest_url` | URL for uploading PDFs and starting ingest |
| `get_ingest_status_url` | URL for polling ingest job status |
| `sqs_queue_url` | SQS queue URL for ingest jobs |
| `s3_bucket` | Object Storage bucket name |

### Function Code Deployment

Function code is bundled and deployed via Terraform. Build the zips first, then apply:

```bash
make            # bundles each function with esbuild, produces dist/functions/*.zip
cd terraform
terraform apply
```

Terraform references the zips via `zip_file` / `zip_hash`, so it redeploys automatically when code changes. `make clean` removes the build artifacts.

## Architecture Notes

- **Monorepo** — `packages/core` contains shared types, storage interfaces, extraction logic, and job status management; `functions/` contains serverless handlers; the Vite + React app is the frontend
- **Adapter pattern** — `ExerciseStorage` and `FileStorage` interfaces with pluggable implementations: S3 for production, local filesystem for dev
- **Async ingest pipeline** — `POST /api/ingest` saves the PDF to S3, writes job status to `status/{jobId}.json`, and sends a message to SQS; the `ingest-worker` (SQS-triggered) handles extraction, validation, and saving; clients poll status via `GET /api/ingest/status`
- **S3 for job status** — job progress is tracked in S3 `status/{jobId}.json`; lifecycle rules expire status and intake files after 48h
- **Sessions are client-side only** — stored in `localStorage`, no server persistence
- **Auth is API-level** — no middleware route protection; `/admin` page is accessible without login but upload will 401
- **AI generates original questions** — the system prompt instructs the AI to create fresh exercises inspired by the PDF, not extract verbatim content

## Tech Stack

Vite, React 19, React Router, TypeScript, Tailwind CSS, Clerk, KaTeX, mathjs, Zod, Playwright, Vitest, AWS S3/SQS SDK, Terraform (Scaleway)
