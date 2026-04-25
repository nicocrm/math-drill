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
- **Storage** — Flat-file JSON in S3 (or local disk for local development without a bucket)

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
| `GET /api/ingest/status?jobId=...` | No | Poll job progress (JSON) |

## Getting Started

1. Copy `.env.example` to `.env` and configure your API key(s) and optional Clerk keys.
2. **First-time (Redis for BullMQ):** start Redis and leave it running (e.g. `docker compose up -d`). Local dev and tests expect `REDIS_URL` (default `redis://127.0.0.1:6379` when using Docker as documented).
3. Install and run (Node 22+; run `corepack enable` once so the `packageManager` field activates the pinned **pnpm**):

```bash
pnpm install
pnpm run dev
```

This runs **Vite (UI)**, the **API** on port `3001` (or `PORT`), and the **ingest worker** (BullMQ) together. The dev server proxies `/api/*` to the API. Open [http://localhost:3000](http://localhost:3000).

After `pnpm install`, [Husky](https://typicode.github.io/husky/) installs a **pre-commit** hook that runs `pnpm lint`. To skip hooks in an emergency (use sparingly): `HUSKY=0 git commit …`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API HTTP port (set `PORT` in production) |
| `REDIS_URL` | — | BullMQ connection (e.g. `redis://127.0.0.1:6379` locally, `redis://redis:6379` on Coolify) |
| `WORKER_CONCURRENCY` | `3` | Max parallel ingest jobs per worker process |
| `STORAGE` | (local) | Set `s3` to use Scaleway Object Storage; otherwise local `EXERCISES_DIR` / `INTAKE_DIR` / filesystem job status |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION` | — | Required when `STORAGE=s3` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | — | S3 API credentials (e.g. Scaleway IAM) |
| `EXTRACTION_PROVIDER` | `anthropic` | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | — | Required when provider is `anthropic` |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `VERIFY_EXPLANATIONS` | `true` | Set `false` to skip explanation fact-checking |
| `EXERCISES_DIR` | `./exercises` | Path for saved exercise JSON files (local storage) |
| `INTAKE_DIR` | `./intake` | Path for uploaded PDFs (local storage) |
| `VITE_CLERK_PUBLISHABLE_KEY` | — | Clerk key (Vite; optional in dev) |
| `CLERK_SECRET_KEY` | — | Clerk secret (API auth) |
| `CLERK_JWT_KEY` | — | JWT public key (local verification when JWKS is unavailable) |

`NODE_ENV=production` makes the API process also serve the built SPA and static assets from `dist/frontend` (same origin as `/api/*`).

## Running Tests

```bash
pnpm test                 # Unit tests
pnpm run test:integration # Integration tests (BullMQ + real Redis; start Redis first)
pnpm run test:e2e         # Playwright (needs Redis, same as `pnpm run dev`)
```

The integration suite expects Redis; use `docker compose up -d` (or any Redis on `REDIS_URL`).

First-time Playwright setup:

```bash
pnpm exec playwright install chromium
```

## Production build (local check)

```bash
pnpm run build:all
NODE_ENV=production PORT=3001 node dist/server/api.js
```

This serves the SPA at `/` and the API at `/api/*` on the same port.

## Deployment (Coolify)

**Prerequisites:** a VPS with [Coolify](https://coolify.io/) installed, a domain pointed at that server, and a Scaleway Object Storage bucket (or any S3-compatible bucket) for exercises, PDFs, and job status JSON.

**Idea:** one **Docker** image, two **applications** (API + worker) and one **Redis** service. Deploys are `git push` to the tracked branch; either Coolify rebuilds from the `Dockerfile`, or you run a pre-built image from the registry (below).

1. In Coolify, add a **Redis** service (not publicly exposed) on the internal network.
2. **Application: API** — build from the repo `Dockerfile`. Start command: `node dist/server/api.js`. Expose port `3001`. Attach your domain; Coolify/Traefik terminates TLS. Set `PORT=3001` and `NODE_ENV=production`.
3. **Application: worker** — same image and repo. Start command: `node dist/server/worker.js`. No public port. Set `WORKER_CONCURRENCY=3` (tunable).
4. **Build arguments:** pass `VITE_CLERK_PUBLISHABLE_KEY` (and any other `VITE_*` required at build time) as Docker build args in Coolify so `pnpm run build` embeds them in the SPA.
5. **Runtime env (shared on both app and worker):** `STORAGE=s3`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `REDIS_URL` (e.g. `redis://redis:6379` to match your Redis service name), `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `EXTRACTION_PROVIDER`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `VERIFY_EXPLANATIONS` as needed.

**Pre-built image (CI → GitHub Container Registry).** The workflow in `.github/workflows/ci.yml` builds the same `Dockerfile` and **pushes** to **GHCR** on pushes to the repo (not on pull requests). The image is `ghcr.io/<github-owner-lowercase>/<repo>:latest` (on `main` / `master` only), plus per-branch and SHA tags. In GitHub, add a repository **Actions** secret `VITE_CLERK_PUBLISHABLE_KEY` with your publishable key so the baked SPA matches production Clerk. In Coolify, add a second resource type **Docker image** (or your UI’s “pull from registry” option): set registry to `ghcr.io`, image to `owner/repo`, tag to `latest` (or a commit SHA for pinning), and authenticate with a GitHub **personal access token** that has `read:packages` (and access to that package, if it is private). If the package is public, you may not need a token for read-only pull. The same `node dist/server/api.js` / `node dist/server/worker.js` start commands and runtime env as above apply; you skip Coolify’s “build from Dockerfile” step for the image.

**Optional — Terraform (Scaleway S3 + IAM only):** provision the exercises bucket and IAM API key for the app. From the repo:

```bash
cd terraform
terraform init
terraform apply -var="project_id=YOUR_SCALEWAY_PROJECT_ID" …
```

Outputs include `s3_bucket` and the IAM credentials to paste into Coolify. No serverless functions, queues, or S3 website bucket are required anymore.

**After deploy, verify once:** the SPA loads at `https://<domain>/`, `GET /api/exercises` returns JSON, `GET /api/unknown` returns `{"error":"Not found"}` (not the SPA), an arbitrary path like `/admin/foo` still returns the SPA, PDF upload runs through the worker, and you add the Coolify domain in Clerk as an allowed origin.

## Architecture Notes

- **Monorepo** — `packages/core` holds types, storage, extraction, ingest logic, and env-based storage factories. `server/` is the Node API + BullMQ worker. The Vite app is the SPA.
- **Async ingest** — `POST /api/ingest` stores the PDF, writes initial job status, and enqueues a BullMQ job. The worker runs `handleIngest`, which updates S3 (or local) `status/{jobId}.json` and saves the exercise. Clients poll `GET /api/ingest/status`.
- **Same origin** — Production serves the built SPA and APIs from the same `PORT`; no CORS, no per-endpoint frontend env URLs.
- **Sessions** — client-side in `localStorage` only
- **Auth** — `verifyAuth` on protected API routes; `/admin` is reachable but uploads 401 if not signed in

## Tech Stack

Vite, React 19, React Router, TypeScript, Tailwind CSS, Clerk, KaTeX, mathjs, Zod, Playwright, Vitest, Express, BullMQ, Redis, AWS S3 client (S3-compatible storage), Terraform (optional Scaleway bucket + IAM)
