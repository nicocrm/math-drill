# Migration from Scaleway Serverless to a VPS (Coolify-supervised)

**Date:** 2026-04-24
**Status:** Implemented

## Goal

Replace the six Scaleway Serverless Functions + SQS trigger with a small number
of long-lived Node processes running on a VPS, supervised by
[Coolify](https://coolify.io/). Keep Scaleway Object Storage (S3-compatible) as
the durable store for exercises, uploaded PDFs, and job status. Remove the
per-invocation cold-start cost, the zip-bundle build pipeline, and the
intermediate "upload PDF to S3 so the worker can download it again"
round-trip.

## Non-goals

- Swapping the storage backend. `S3ExerciseStorage` / `S3FileStorage` /
  `S3JobStatusStore` stay. Only the compute tier moves.
- Horizontal scaling. One API replica + one worker replica is the target.
  If we ever need more, BullMQ + S3 already support it; we just scale the
  Coolify service.
- CDN / geo-distribution of the SPA. If latency ever matters, putting
  Cloudflare's free tier in front of the Coolify domain is a 5-minute
  follow-up; not in this plan.

## Architecture

```
                    ┌──────────────────┐
                    │  Clerk (JWT)     │
                    └────────┬─────────┘
                             │ verify
                             ▼
                ┌─────────────────────────────────┐
   HTTPS        │  api process (Node, :3001)       │
   browser ───▶│  - GET / → SPA (static files)    │
                │  - /api/* → Express routes       │◀───┐
                │  - enqueues ingest jobs          │    │ polling
                └────────┬────────────────────────┘    │ /api/ingest/status
                         │ BullMQ add job               │
                         ▼                              │
                ┌────────────────────┐                  │
                │  Redis (Coolify    │                  │
                │  managed service)  │                  │
                └────────┬───────────┘                  │
                         │ BullMQ consume               │
                         ▼                              │
                ┌────────────────────┐                  │
                │  worker process    │                  │
                │  (Node)            │                  │
                │  concurrency = N   │                  │
                │  - generate ex.    │                  │
                │  - verify expl.    │                  │
                │  - save to S3      │──────────────────┘
                │  - update job S3   │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │  Scaleway Object    │
                │  Storage (S3)       │
                │  - exercises/       │
                │  - intake/ (PDF)    │
                │  - status/ (job)    │
                └────────────────────┘
```

The SPA and the API are served from the **same origin** by the same Node
process. No CORS, no separate frontend bucket, no multi-URL config in
`src/lib/api.ts`.

Two Coolify "Applications" deployed from the same git repo, same image:

| Service | Command | Replicas | Public | Notes |
|---|---|---|---|---|
| `api` | `node dist/server/api.js` | 1 | Yes (HTTPS via Coolify/Traefik) | Handles all HTTP routes |
| `worker` | `node dist/server/worker.js` | 1 | No | Consumes BullMQ queue |

Plus one Coolify-managed service:

| Service | Purpose |
|---|---|
| `redis` | BullMQ backing store. Not exposed publicly. |

## Why this shape (key decisions)

| Decision | Choice | Alternative rejected | Why |
|---|---|---|---|
| Supervision | Coolify | systemd directly on box | User has decided Coolify. TLS/redeploy/logs come for free. |
| Durable storage | Scaleway S3 (unchanged) | Local disk on VPS | Single-VPS disk failure = total data loss. S3 already works; no reason to break it. |
| Job queue | **BullMQ + Redis** | In-memory + HTTP (like `dev-worker.ts`) | In-memory jobs are lost on worker restart/redeploy mid-extraction — a real failure mode with 30–90s AI calls. |
| Job queue | BullMQ + Redis | SQS (keep current) | Dropping SQS removes one Scaleway dependency; BullMQ is the Node-native standard and integrates with Coolify trivially. |
| Concurrency | BullMQ `concurrency` option on the Worker | `worker_threads` / child processes | AI extraction is I/O-bound (OpenAI/Anthropic HTTP). A single event loop handles many concurrent jobs fine. Bound is for memory/API-rate, not CPU. |
| Auth | Unchanged — Clerk JWT via `@clerk/backend` | — | Already env-var driven, ports as-is. |
| Frontend hosting | Express serves `dist/frontend` same-origin | Keep S3 website bucket | Eliminates CORS, drops the five `VITE_*_URL` env vars, collapses `src/lib/api.ts` back to relative paths, one deploy instead of two. Node serving static files is not a perf concern at this scale; Coolify zero-downtime deploy handles the redeploy-blip concern. |
| Local dev queue | Real Redis via `docker compose up -d redis` | (a) abstract `IngestQueue` with in-memory dev impl; (b) `ioredis-mock`; (c) keep current HTTP dispatch in dev only | Dev/prod parity is the *whole point* of switching to BullMQ — if dev doesn't exercise the actual queue code (graceful shutdown, concurrency, retries), we ship untested queue semantics. Redis idle is ~5MB; `restart: unless-stopped` makes it a one-time start. The "no Docker in dev" property the repo had under HTTP-dispatch is genuinely lost, but it was only valid because the previous queue was trivial. |
| SSE for status | Drop, continue JSON polling | Add SSE support on API process | Status polling already works. SSE is a later optimization. |

## Concurrency bound — what number?

Target: **`WORKER_CONCURRENCY=3`** as the starting value.

Reasoning:

- Typical AI extraction is 30–90s, dominated by OpenAI/Anthropic round-trip.
- Peak memory per job is a 50MB PDF buffer + the JSON exercise set (a few
  hundred KB). Three concurrent jobs ≈ 150MB peak — safe on a 1GB VPS with
  headroom for Node runtime and the API process.
- OpenAI/Anthropic rate limits at typical paid-tier usage are not the
  bottleneck at 3 concurrent.
- BullMQ will queue the rest; clients keep polling `/api/ingest/status` and
  see `status=pending` until their job is picked up — UI already handles this.

Tunable via env var. Document in README.

## Local development

After this migration, local dev requires **Redis running on `localhost:6379`**
because BullMQ has no in-memory mode. We accept the Docker dependency for
the dev/prod parity reasons in the decisions table above.

Setup is one-time and persistent across reboots:

```bash
docker compose up -d            # starts Redis with restart=unless-stopped
npm install
npm run dev                     # Vite + api + worker (tsx --watch)
```

`docker-compose.yml` becomes:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
```

`npm run dev` does **not** depend on `docker compose up` — it just expects
`REDIS_URL` to be reachable. If Redis is down, BullMQ throws on connect with
a clear error pointing at `localhost:6379`. README documents the one-line
fix.

For contributors without Docker (rare): any Redis works — `brew services
start redis`, a remote Redis URL, or a teammate's tunnel. `REDIS_URL` is
just a connection string.

For CI: GitHub Actions gets Redis via `services:`:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    options: >-
      --health-cmd "redis-cli ping" --health-interval 10s
      --health-timeout 5s --health-retries 5
```

This makes the existing `npm run test:integration` and (new) BullMQ unit
tests run against a real queue in CI, not a mock.

## Scope — what gets deleted

| Current | Fate |
|---|---|
| `functions/dev-server.ts` | **Keep**, but becomes the *production* entry point too (rename and refactor — see Phase 2). |
| `functions/dev-worker.ts` | **Delete**. Replaced by BullMQ worker. |
| `functions/*/handler.ts` (5 handlers) | **Keep as route handlers**, flattened into the Express server. The `ScalewayEvent` shim goes away. |
| `functions/lib/scaleway.ts` (`ScalewayEvent`, `jsonResponse`, CORS helpers) | **Delete**. Use plain Express `req`/`res`. CORS goes away entirely (same-origin). |
| `functions/ingest-worker/handler.ts` (the Scaleway SQS entry point) | **Delete.** `handleIngest()` (the exported business function) moves to `packages/core` and is called by the BullMQ processor. |
| SQS send/receive logic in `post-ingest/handler.ts` | **Delete** — replaced by BullMQ `queue.add()`. |
| `packages/core/src/jobStatus/fileJobStatusStore.ts` | **Delete.** Only exists because dev-server and dev-worker were separate processes on different machines in prod — now irrelevant. `S3JobStatusStore` is used everywhere. |
| `Makefile` (esbuild zip bundling) | **Replace** with plain `npm run build:server`. |
| `terraform/main.tf` — all `scaleway_function*`, `scaleway_mnq_sqs*`, `scaleway_function_trigger`, `scaleway_object_bucket.frontend` (+ ACL, website config) | **Delete.** Keep only: object bucket for exercises data (+ lifecycle rules) and IAM app/policy/key for S3 access. |
| `scripts/smoke-test-functions.sh` | **Delete** — tests hit a single origin now and are covered by Playwright E2E. |
| `.env.example` — the five `VITE_*_URL` production URLs + `VITE_API_URL` | **Delete.** SPA uses relative paths. |
| `src/lib/api.ts` — multi-URL resolution logic | **Collapse** to plain relative `/api/*` paths. All `getXxxUrl()` helpers become one-liners. |
| `Makefile` — `build-frontend`, `deploy-frontend`, `functions`, `$(DIST)/%.zip` targets | **Delete.** Frontend is built inside the Docker image; deploy = `git push`. |
| `docker-compose.yml` (currently a comment-only stub saying "no Docker required") | **Replace** with a real Redis service for local dev (see "Local development" section). |

## Phases

### Phase 1 — Extract `handleIngest` into `packages/core`

Goal: no more "core logic lives inside `functions/`". This is a precondition
for calling the same function from both the Express server (dev smoke path)
and the BullMQ worker, without importing across the `functions/` boundary.

- [ ] Move `handleIngest` + `IngestPayload` from `functions/ingest-worker/handler.ts`
      to `packages/core/src/ingest/handleIngest.ts`. Keep its signature.
- [ ] Move `getExerciseStorage` / `getFileStorage` / `getJobStatusStore` from
      `functions/lib/env.ts` to `packages/core/src/env.ts`. These are already
      storage-abstraction factories — they belong in core.
- [ ] Update the existing integration test
      `functions/ingest-worker/handler.integration.test.ts` → move next to the
      new location, keep the same mocking strategy.
- [ ] Delete `functions/ingest-worker/` entirely.

**Verify:** `npm test` (incl. integration) stays green. No code in `functions/`
imports the removed files.

### Phase 2 — Collapse HTTP handlers + SPA into a single Express app

Replace per-function handlers + `ScalewayEvent` shim with plain Express
handlers. The five HTTP routes become five route functions in one app, and
the same app serves the SPA static files from `dist/frontend`.

- [ ] Create `server/app.ts` exporting `createApp({ serveStatic: boolean })`
      that returns an Express app with:
  - JSON / raw-PDF body parsers.
  - All five `/api/*` routes wired.
  - **If `serveStatic`:** static file middleware for `dist/frontend`, with
    correct cache headers (see snippet below), and an SPA fallback for
    non-`/api` routes.
  - **No CORS middleware** — same-origin makes it moot. CORS code and
    `ALLOWED_ORIGIN` env var are deleted entirely.
- [ ] Static + SPA fallback snippet (order matters — API routes first, static
      second, SPA fallback last):
  ```ts
  // 1. API routes already registered above this block.

  // 2. Hashed assets: immutable, long cache.
  app.use('/assets', express.static(
    path.join(DIST_FRONTEND, 'assets'),
    { maxAge: '1y', immutable: true },
  ));

  // 3. Other static files (index.html, favicon, fonts): short cache.
  app.use(express.static(DIST_FRONTEND, { maxAge: '5m', index: false }));

  // 4. Unknown /api/* → JSON 404 (prevents SPA fallback from swallowing it).
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // 5. SPA fallback for everything else.
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_FRONTEND, 'index.html'));
  });
  ```
- [ ] Rewrite each handler as `(req, res) => ...` using `req.body`,
      `req.query`, `req.params`, `req.headers.authorization`. Delete
      `ScalewayEvent`, `jsonResponse`, `handleCorsPreflightMaybe`. Use
      `res.status().json()` directly.
- [ ] `post-ingest`: remove the SQS/HTTP-worker dispatch block and replace
      with `await ingestQueue.add('ingest', payload)` (queue module added in
      Phase 3). Keep: auth check, PDF size/MIME validation, S3 upload, initial
      status write.
- [ ] Collapse `src/lib/api.ts` to relative-path only — no env-var branching:
  ```ts
  export const getExercisesUrl = (mine?: boolean) =>
    `/api/exercises${mine ? '?mine=1' : ''}`;
  export const getExerciseUrl = (id: string) => `/api/exercises/${id}`;
  export const deleteExerciseUrl = (id: string) => `/api/exercises/${id}`;
  export const postIngestUrl = () => `/api/ingest`;
  export const getIngestStatusUrl = (jobId: string) =>
    `/api/ingest/status?jobId=${encodeURIComponent(jobId)}`;
  export const authHeaders = (token: string | null) =>
    token ? { Authorization: `Bearer ${token}` } : {};
  ```
  Remove all `VITE_API_URL` / `VITE_*_URL` references from `src/lib/api.ts`
  and from `env.d.ts`.
- [ ] Create `server/api.ts` — entry point:
      `createApp({ serveStatic: true }).listen(PORT)`.
- [ ] Create `server/worker.ts` — BullMQ worker entry point (Phase 3).
- [ ] Add `npm run build:server` (esbuild bundle of both entry points into
      `dist/server/api.js` and `dist/server/worker.js`, platform=node,
      format=esm, target=node22, external dependencies kept so `node_modules`
      is used at runtime).
- [ ] Add `npm run start:api` / `npm run start:worker` — run the built files.
- [ ] Update `npm run dev` to run `server/api.ts` + `server/worker.ts` via
      `tsx --watch`, dropping the `INGEST_WORKER_URL` dance. Dev still uses
      Vite on :3000 for HMR; Vite proxies `/api/*` to Express on :3001.
      `{ serveStatic: false }` in dev because Vite owns the SPA.

**Unit tests** (non-UI, allowed under `AGENTS.md`):
- [ ] `server/app.test.ts`: request against an app with
      `{ serveStatic: true }` and a fixture `dist/frontend/index.html`.
  - `GET /api/exercises` returns the API response (JSON, status 200).
  - `GET /api/definitely-not-a-route` returns **JSON 404**, not `index.html`.
    This locks in the route-ordering requirement.
  - `GET /some/spa/route` returns `index.html` with status 200.
  - `GET /assets/foo.js` sets `Cache-Control: public, max-age=31536000, immutable`.
  - `GET /index.html` sets `Cache-Control: public, max-age=300`.

**Verify:**
- All existing E2E tests (`tests/e2e/*.spec.ts`) pass against `npm run dev`
  unchanged (because Vite proxy still routes `/api/*` to Express — no SPA
  env var changes affect dev).
- `npm run build && npm run build:server && node dist/server/api.js`
  serves the SPA at `/` and the API at `/api/*` from one origin.

### Phase 3 — BullMQ queue + worker

- [ ] Add `bullmq` + `ioredis` to root `dependencies`.
- [ ] Replace `docker-compose.yml` with the Redis service shown in the
      "Local development" section (`redis:7-alpine`,
      `restart: unless-stopped`, port 6379, healthcheck). Run
      `docker compose up -d` once.
- [ ] Add `REDIS_URL=redis://localhost:6379` to `.env.example`.
- [ ] Create `server/queue.ts`:
  ```ts
  import { Queue } from 'bullmq';
  import IORedis from 'ioredis';
  export const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // required by BullMQ
  });
  export const ingestQueue = new Queue<IngestPayload>('ingest', { connection });
  ```
- [ ] Create `server/worker.ts`:
  ```ts
  import { Worker } from 'bullmq';
  import { handleIngest } from '@math-drill/core/ingest/handleIngest';
  new Worker<IngestPayload>('ingest',
    async (job) => handleIngest(job.data),
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
    },
  );
  ```
  Graceful shutdown on `SIGTERM`: `await worker.close()` (lets in-flight jobs
  finish — Coolify sends SIGTERM on redeploy; BullMQ waits).
- [ ] Remove `SQSClient`-based dispatch from `post-ingest` (done in Phase 2
      already — this phase wires the replacement).
- [ ] On job failure in the worker, `handleIngest` already writes
      `status=error` to the job status store. Add BullMQ-level retry
      (`attempts: 2, backoff: { type: 'exponential', delay: 5000 }`) as a
      belt-and-braces for transient AI API failures.
- [ ] **Tests** (non-UI, allowed under `AGENTS.md`):
  - **Unit test** (BullMQ mocked, no Redis): `post-ingest` route enqueues
    correctly — `queue.add` called with the right payload shape and auth'd
    `userId`.
  - **Integration tests** (real Redis via the Phase 3 docker-compose; live
    in `vitest.integration.config.ts` so they don't run on every `npm test`):
    - Concurrency bound: with `WORKER_CONCURRENCY=2`, enqueue 4 jobs where
      `handleIngest` is stubbed to block on a promise; assert only 2 are in
      "active" state at any moment.
    - Graceful shutdown: start a long-running stubbed job, call
      `worker.close()`, assert the job completes before `close()` resolves.
    - Restart redelivery: enqueue a job, kill the worker mid-execution
      (close without grace), spin up a new worker, assert the job is
      re-delivered and runs to completion. This is the test that actually
      proves we solved the "lost job on redeploy" problem.

**Verify:**
- Upload a PDF via the running `npm run dev`, confirm the job runs through
  BullMQ (job appears in Redis, worker logs start/end, status in S3
  `status/{jobId}.json` progresses `pending → extracting → done`).
- `npm run test:e2e` (Playwright) passes end-to-end against the new stack.

### Phase 4 — Coolify deployment

- [ ] Add a multi-stage `Dockerfile` at repo root:
  - Stage 1 (`builder`): `FROM node:22-alpine`, `npm ci`,
    `npm run build` (Vite → `dist/frontend`),
    `npm run build:server` (esbuild → `dist/server`).
  - Stage 2 (`runtime`): `FROM node:22-alpine`, copy `package*.json`,
    `npm ci --omit=dev`, copy `dist/` from builder.
  - `CMD` is **not** set in the Dockerfile — Coolify overrides it per service
    to either `node dist/server/api.js` or `node dist/server/worker.js`.
  - One image, two services. No `Dockerfile.api` / `Dockerfile.worker` split.
- [ ] Coolify configuration (documented in README — Coolify owns the state):
  - **Application: `math-drill-api`** — build from `Dockerfile`, start
    command `node dist/server/api.js`, port `3001` exposed, domain attached
    (Coolify issues Let's Encrypt cert via Traefik). Serves both `/` (SPA)
    and `/api/*`.
  - **Application: `math-drill-worker`** — same repo + image, start command
    `node dist/server/worker.js`, no port exposed.
  - **Service: `redis`** — Coolify's built-in Redis service template. Expose
    only on the internal Coolify network.
  - **Shared env vars** (set at Coolify project level, applied to both apps):
    - `STORAGE=s3`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`
    - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (Scaleway IAM API key —
      Terraform still provisions this)
    - `REDIS_URL=redis://redis:6379` (Coolify's internal DNS name for the
      Redis service)
    - `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`
    - `VITE_CLERK_PUBLISHABLE_KEY` (needed at **build time** — set as a
      Coolify build arg, not a runtime env var)
    - `EXTRACTION_PROVIDER`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
    - `VERIFY_EXPLANATIONS`
  - **API-only:** `PORT=3001`.
  - **Worker-only:** `WORKER_CONCURRENCY=3`.
- [ ] Gut `terraform/main.tf`. Remove:
  - All `scaleway_function*` resources and the function namespace.
  - `scaleway_mnq_sqs`, `scaleway_mnq_sqs_credentials`,
    `scaleway_mnq_sqs_queue`, `scaleway_function_trigger`.
  - `scaleway_object_bucket.frontend` + its ACL + website configuration.
  - All Makefile-dependent outputs (`get_exercises_url` etc.,
    `clerk_publishable_key`, `frontend_url`, `frontend_bucket`,
    `sqs_queue_url`).

  Keep:
  - `scaleway_object_bucket.exercises` + the two lifecycle rules.
  - `scaleway_iam_application.functions` (rename to `math_drill_app`),
    `scaleway_iam_policy.s3_access`, `scaleway_iam_api_key.functions`.
  - `s3_bucket` output (used to populate Coolify env vars).
- [ ] Delete `Makefile` entirely (no zip build, no `deploy-frontend`, no
      `build-frontend`). Replace with a short README paragraph:
      "Deploy = `git push` to the default branch; Coolify rebuilds the
      Dockerfile and redeploys both apps with zero downtime."
- [ ] Delete `scripts/smoke-test-functions.sh`.
- [ ] Delete `functions/dev-server.ts` and `functions/dev-worker.ts` (their
      responsibilities moved to `server/api.ts` and `server/worker.ts` in
      Phase 2/3).
- [ ] Delete `functions/` directory entirely if no files remain. Update
      `functions/tsconfig.json` reference in root `tsconfig.json` if present.
- [ ] Update `README.md`:
  - **Getting Started** — replace the existing "PDF ingestion: run the ingest
    worker in a second terminal" paragraph with: "First-time setup:
    `docker compose up -d` (starts Redis with `restart: unless-stopped`).
    Then `npm run dev` runs Vite + api + worker together. Redis stays up
    across reboots — you only run `docker compose up -d` once."
  - New "Deployment (Coolify)" section replacing the Scaleway/Terraform
    functions section. Prerequisites: a VPS with Coolify installed, a domain
    pointed at it, Scaleway Object Storage credentials.
  - Walkthrough: create the three Coolify resources (api app, worker app,
    redis service), set env vars, connect the repo, deploy.
  - Update env var table: add `REDIS_URL`, `WORKER_CONCURRENCY`; remove the
    five `VITE_*_URL` entries; remove `INGEST_WORKER_URL`, `INGEST_WORKER_PORT`;
    remove `SQS_*`; remove `ALLOWED_ORIGIN`.
  - Remove the "Testing the Static Build Locally" section — obsolete, since
    `npm run build && node dist/server/api.js` is now the single flow.
- [ ] Update `.env.example`: add `WORKER_CONCURRENCY=3` (`REDIS_URL` was
      added in Phase 3); delete all `VITE_*_URL` lines and
      `INGEST_WORKER_*` / `SQS_*` lines.
- [ ] CI: add a Redis service to the test job (GitHub Actions `services:`
      block per the snippet in the "Local development" section) so the
      Phase 3 integration tests run on PRs.
- [ ] Delete obsolete plans superseded by this one:
  - `docs/plans/2026-03-13-serverless-migration-scaleway.md` — its Phase 4/5
    describe the now-discarded Scaleway-functions-to-S3-frontend setup.
  - `docs/plans/2026-03-13-phase4-static-deploy-scaleway.md` — the
    S3-website-bucket deploy story, replaced by Coolify same-origin hosting.

**Verify (manual, checklist in PR):**
- Coolify deploys api + worker + redis; `docker ps` on the VPS shows all three
  containers healthy.
- `curl https://<domain>/api/exercises` returns `200` with JSON.
- `curl https://<domain>/` returns the SPA HTML. `curl https://<domain>/assets/<hash>.js`
  returns JS with `Cache-Control: public, max-age=31536000, immutable`.
- `curl https://<domain>/api/bogus` returns `{"error":"Not found"}` with
  status 404 (not the SPA HTML).
- `curl https://<domain>/arbitrary/spa/route` returns the SPA HTML with status
  200 (SPA fallback).
- Upload a PDF through the live SPA, job progresses to `done`, exercise
  appears on `/`.
- Trigger "redeploy" in Coolify while a job is mid-extraction; confirm the
  job either completes (graceful shutdown within the terminationGracePeriod)
  or is re-picked by the new worker instance (BullMQ redelivers). Either
  outcome is acceptable; a *stuck* job is not.
- Clerk login flow works on the Coolify domain (after adding the domain to
  the Clerk dashboard's allowed origins — one-time manual step, document in
  README).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Worker crashes during a 60s AI call | BullMQ persists the job in Redis; on worker restart, job is re-delivered. `handleIngest` is idempotent *enough* (writes to a fixed `exerciseId` — a retry will overwrite; status transitions are monotonic). Verify by test in Phase 3. |
| OOM from burst of large PDF uploads | `WORKER_CONCURRENCY=3` caps in-flight extraction. API process reads the PDF once into a buffer, uploads to S3, and discards — memory is released before worker picks up. |
| Redis outage | Coolify-managed Redis has local persistence (AOF). If Redis dies, in-flight queue entries are lost (not jobs — the underlying S3 data is fine; just the "please process this" message). Worst case: user sees a stuck `pending` status. Mitigate with a cron/manual reconciliation script (out of scope; low probability). |
| Data loss on VPS disk failure | **None** — no app data on VPS disk. All exercises, PDFs, and job status live in Scaleway S3. A VPS replacement is a fresh Coolify deploy pointing at the same bucket. |
| TLS expiry | Coolify + Traefik + Let's Encrypt handles renewal automatically. |
| Single-region VPS outage | Accepted — this is a single-user-class app. Scaleway region outages are rare; Coolify can redeploy in another region if ever needed. |
| BullMQ version drift vs `ioredis` / Node 22 | Pin versions in `package.json`. BullMQ is actively maintained; Node 22 is LTS. |
| Losing SQS retry semantics | BullMQ's `attempts` + exponential backoff provides the equivalent. Configure in the Worker. |

## Rollback

Each phase is independently revertible:

- **Phase 1** — pure refactor, no deploy change. Git revert.
- **Phase 2** — no deploy change yet. The Scaleway functions still run the
  old code until Phase 4.
- **Phase 3** — local + test-env only. Revert if BullMQ causes integration
  issues.
- **Phase 4** — the cutover. Rollback path: `git revert` the commit that
  deleted the Scaleway Terraform resources and the Makefile, then
  `terraform apply` and `make deploy-frontend`. SPA data is untouched (same
  S3 exercises bucket, untouched by this plan). Worst-case rollback is
  ~30 min of Terraform + SPA rebuild. The `src/lib/api.ts` relative-path
  collapse would also need reverting so the SPA again points at the Scaleway
  function URLs.

## Out-of-scope / deferred

- Metrics / tracing on the API process (Prometheus endpoint, OpenTelemetry).
- Multi-region failover.
- Autoscaling the worker.
- Migrating away from Scaleway for S3.
- Replacing Clerk.

## Progress log

- **2026-04-24:** Implementation complete: Express API + worker, BullMQ, same-origin SPA, Terraform trim, Docker, CI with Redis. E2E: `ensure-e2e-storage` runs before the web server (Playwright starts the server before `globalSetup`); `dotenv` then `e2eEnv` so the marker overrides `.env`; marker path from `server/e2eEnv.ts` `import.meta.url` (cwd-safe). E2E navigation uses `HashRouter` URLs (`/#/admin`, etc.).
