# Serverless Migration to Scaleway

## Language Choice

| Factor | TypeScript | Python | Go |
|---|---|---|---|
| Code reuse from existing codebase | Direct reuse of `exerciseSchema.ts`, `mathValidation.ts`, extraction providers, Zod schemas | Full rewrite | Full rewrite |
| AI SDK availability | `@anthropic-ai/sdk`, `openai` — already in use | `anthropic`, `openai` — mature | Community libs only, less mature |
| NATS client | `nats.js` — official, well-maintained | `nats.py` — official, async support | `nats.go` — best-in-class, reference impl |
| Cold start on Scaleway | ~300-500ms (Node.js) | ~300-500ms | ~50-100ms (fastest) |
| Math validation (`mathjs`) | Direct reuse | Would need `sympy` or similar (different behavior) | No equivalent |
| Scaleway runtime support | Node.js (supported) | Python (supported) | Go (supported) |

**DECISION: TypeScript (Node.js)**

The deciding factor is **code reuse**. The extraction pipeline, Zod schemas, math validation, and AI SDK calls are already written and tested in TypeScript. Rewriting in Go or Python gains nothing — the functions are I/O-bound (waiting on AI APIs and S3), so Go's performance advantage is irrelevant. Cold start difference is negligible for this use case.

## Architecture Overview

```
┌──────────┐                         ┌─────────────┐
│  Clerk    │◀── JWT verify ───┐     │  Scaleway    │
│  (auth)   │                  │     │  Object      │
└──────────┘                   │     │  Storage     │
      ▲                        │     │  (exercises/ │
      │ login/token            │     │   intake/)   │
      │                        │     └──────┬───────┘
┌─────┴────┐   HTTP    ┌──────┴─────────────┼───────────────┐
│  Next.js  │────────▶ │  Serverless Functions               │
│  Frontend │          │                                      │
│  (static) │          │  GET /exercises      (list, ?mine=1) │
│           │◀──────── │  GET /exercises/:id  (detail)        │
│           │          │  DELETE /exercises/:id (auth+owner)   │
│           │          │  POST /ingest        (auth required)  │
│           │          │  GET /ingest/status  (poll)           │
└──────────┘          └────────────┬─────────────────────────┘
                                   │
                          publish   │   NATS KV
                          {jobId,   ▼   (job status)
                          userId}  ┌─────────────────┐
                                   │  Scaleway NATS   │
                                   │  (Messaging)     │
                                   └────────┬─────────┘
                                            │ trigger
                                            ▼
                                   ┌─────────────────┐
                                   │  Ingest Worker   │
                                   │  (serverless fn) │
                                   │                  │
                                   │  - fetch PDF     │
                                   │  - call AI API   │
                                   │  - validate      │
                                   │  - save to S3    │
                                   │    (keyed by     │
                                   │     userId)      │
                                   │  - update KV     │
                                   └──────────────────┘
```

## Phase 1: Extract Shared Library

Decouple server-side logic from Next.js API routes into a standalone package.

- [x] Create `packages/core/` with the shared business logic
  - `exerciseSchema.ts` + Zod schemas
  - `mathValidation.ts`
  - `extraction/` (anthropicProvider, openaiProvider, verifyExplanations, prompts)
  - `generateExercisesFromPdf.ts`
  - `types/exercise.ts`
- [x] Create `packages/core/auth.ts` — Clerk JWT verification for serverless functions
  ```typescript
  // Replaces @clerk/nextjs/server auth() calls with @clerk/backend
  import { createClerkClient } from "@clerk/backend";

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  interface AuthResult {
    userId: string | null;
  }

  async function verifyAuth(req: Request): Promise<AuthResult> {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return { userId: null };
    const { sub } = await clerk.verifyToken(token);
    return { userId: sub };
  }

  function requireAuth(auth: AuthResult): asserts auth is { userId: string } {
    if (!auth.userId) throw new HttpError(401, "Unauthorized");
  }
  ```
- [x] Add `@clerk/backend` as dependency for `packages/core/`
- [x] Create `packages/core/storage.ts` — abstract storage interface
  ```typescript
  interface ExerciseStorage {
    list(): Promise<ExerciseSet[]>
    listByUser(userId: string): Promise<ExerciseSet[]>
    get(id: string): Promise<ExerciseSet | null>
    save(exercise: ExerciseSet): Promise<void>
    delete(id: string): Promise<void>
  }
  interface FileStorage {
    upload(key: string, data: Buffer): Promise<void>
    download(key: string): Promise<Buffer>
  }
  ```
- [x] Implement S3 adapter for Scaleway Object Storage (S3-compatible API)
  - S3 key strategy: `exercises/{userId}/{id}.json` for efficient per-user listing
- [x] Create `packages/core/jobStatus.ts` — abstract job status interface
  ```typescript
  interface JobStatusStore {
    get(jobId: string): Promise<JobStatus | null>
    set(jobId: string, status: JobStatus, ttlSeconds?: number): Promise<void>
  }
  ```
- [x] Implement NATS KV adapter for job status
- [x] Existing unit tests should pass against the extracted package

**Verify:** `npm test` in `packages/core/` passes.

## Phase 2: Serverless Functions (HTTP)

Create Scaleway-compatible serverless functions for the API routes.

- [x] `functions/get-exercises/` — list exercise sets from S3; if `?mine=1`, call `verifyAuth()` and filter by `userId`
- [x] `functions/get-exercise/` — fetch single exercise set from S3
- [x] `functions/delete-exercise/` — `requireAuth()`, verify `createdBy` matches `userId` (403 otherwise), delete from S3
- [x] `functions/post-ingest/` — `requireAuth()`, accept PDF upload, store in S3, publish NATS message with `userId` in payload, return jobId
- [x] `functions/get-ingest-status/` — read job status from NATS KV, return JSON
- [x] Configure Terraform for deployment
- [x] Set up environment variables (API keys, NATS credentials, S3 bucket, `CLERK_SECRET_KEY`)

**Verify:** Deploy and test each HTTP endpoint with curl.

## Phase 3: Ingest Worker (NATS-triggered)

- [ ] `functions/ingest-worker/` — triggered by NATS message on `ingest.jobs` subject
  - NATS message payload includes `{ jobId, s3Key, userId }`
  - Download PDF from S3
  - Call AI extraction (reuse `generateExercisesFromPdf`)
  - Optionally verify explanations
  - Save exercise JSON to S3 under `exercises/{userId}/{id}.json`, set `createdBy: userId`
  - Update NATS KV with progress at each step (`extracting` → `validating` → `saving` → `done`)
  - On error, update KV with error status
- [ ] Configure NATS trigger on the function in Scaleway
- [ ] Set function timeout to 5 minutes (Scaleway allows 10s–60min, so plenty of headroom for AI extraction)

**Verify:** Upload a PDF via POST /ingest, poll status, confirm exercise appears in GET /exercises.

## Phase 4: Frontend Deployment

- [ ] Build Next.js frontend as static export (`output: 'export'` in next.config)
  - Remove server-side code from Next.js app
  - Point API calls to the serverless function URLs (env var or proxy)
  - Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at build time (ClerkProvider works client-side in static export)
- [ ] Deploy static assets to Scaleway Object Storage + CDN
- [ ] Alternatively: deploy as Scaleway Serverless Container if SSR is still wanted

**Verify:** Full E2E flow works — upload PDF, see progress, start session, complete drill, view results.

## Phase 5: Cleanup & CI/CD

- [ ] Remove file-system storage code (`exerciseStore.ts` fs calls, `ingestJobs.ts` in-memory map)
- [ ] Remove unused SSE code from `api/ingest/status/route.ts`
- [ ] Set up CI pipeline for deploying functions
- [ ] Add integration tests against deployed endpoints

## Local Development

### Dependencies

Only Docker dependency is NATS. Storage stays on the local filesystem for dev.

```yaml
# docker-compose.yml
services:
  nats:
    image: nats:latest
    command: -js  # enables JetStream / KV
    ports:
      - "4222:4222"
```

### Dev Scripts

```
docker compose up    # NATS on :4222
npm run dev:api      # Express server wrapping function handlers on :3001
npm run dev:worker   # Node process subscribing to NATS ingest subject
npm run dev          # Next.js frontend on :3000, API proxied to :3001
```

Can be combined with `concurrently` into a single `npm run dev:all`.

### Environment Switching

```env
# .env.local (dev)
STORAGE=local
NATS_URL=nats://localhost:4222
EXERCISES_DIR=./exercises
INTAKE_DIR=./intake
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# .env.production
STORAGE=s3
S3_BUCKET=math-drill-exercises
S3_ENDPOINT=https://s3.fr-par.scw.cloud
NATS_URL=nats://<scaleway-nats-endpoint>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

The abstract storage interface from Phase 1 makes this transparent — function code doesn't change between environments.

### Local API Server

A thin Express wrapper mounts the same handler functions used by Scaleway:

```typescript
// dev-server.ts
import express from "express";
import { handler as getExercises } from "./functions/get-exercises";
import { handler as getExercise } from "./functions/get-exercise";
import { handler as postIngest } from "./functions/post-ingest";
import { handler as getIngestStatus } from "./functions/get-ingest-status";

const app = express();
app.get("/api/exercises", getExercises);
app.get("/api/exercises/:id", getExercise);
app.post("/api/ingest", postIngest);
app.get("/api/ingest/status", getIngestStatus);
app.listen(3001);
```

### Local Worker

Runs as a long-lived Node process subscribing to NATS — same code as the serverless function, just not terminated after each invocation:

```typescript
// dev-worker.ts
import { connect } from "nats";
import { handleIngest } from "./functions/ingest-worker";

const nc = await connect({ servers: "nats://localhost:4222" });
const sub = nc.subscribe("ingest.jobs");
for await (const msg of sub) {
  await handleIngest(msg);
}
```

### What Changes vs Current Dev Experience

| Aspect | Before | After |
|---|---|---|
| Start command | `npm run dev` | `docker compose up` + `npm run dev:all` |
| External deps | None | Docker (NATS only) |
| Storage | Local filesystem | Local filesystem (unchanged) |
| Job status | In-memory (auto) | NATS KV (via Docker) |
| Hot reload | Next.js built-in | Next.js + nodemon for api/worker |

## Key Decisions & Risks

| Item | Decision | Risk |
|---|---|---|
| Language | TypeScript — max code reuse | None |
| Auth | Clerk via `@clerk/backend` JWT verification in each function | No Next.js middleware — auth check is per-function. userId passed to worker via NATS payload (no Clerk needed in worker) |
| Execution timeout | AI extraction can take 30-60s+. Scaleway max is **60 minutes** (min 10s) | Plenty of headroom — not a concern |
| PDF size | PDFs uploaded to S3, URL passed via NATS | Large PDFs may need multipart upload |
| NATS KV TTL | Set 1h TTL on job status entries | Stale entries auto-cleaned |
| Static frontend | `next export` loses SSR | App is client-heavy anyway, no real SSR needed |
| Cost | Pay-per-invocation + NATS + S3 | Very low for single-user app |
