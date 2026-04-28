# Unify API serverless functions into one instance

## Goal

Reduce cold-start tax by folding all 5 HTTP functions
(`get-exercises`, `get-exercise`, `delete-exercise`, `post-ingest`,
`get-ingest-status`) into a single Scaleway function (`api`) with internal
path-based routing. Keep `ingest-worker` as a separate function (SQS-triggered,
different memory/timeout profile, not HTTP-facing).

Benefits:
- One warm container serves all API traffic → most requests hit a warm instance.
- Fewer deploy artifacts; simpler frontend config (one URL).
- Module-level singletons (Clerk client, S3 client, SQS client) are reused
  across endpoints.

## Proposed changes

### 1. New unified handler: `functions/api/handler.ts`

- Exports `handle(event: ScalewayEvent)`.
- Top-level router dispatches by `(method, path)`:
  - `OPTIONS *` → `handleCorsPreflightMaybe`
  - `GET  /api/exercises`         → `getExercises`
  - `GET  /api/exercises/{id}`    → `getExercise`
  - `DELETE /api/exercises/{id}`  → `deleteExercise`
  - `POST /api/ingest`            → `postIngest`
  - `GET  /api/ingest/status`     → `getIngestStatus`
  - fallback → `404`
- Reuse existing handler modules under `functions/{get-exercises,...}/handler.ts`
  unchanged (they already take a `ScalewayEvent` and return `ScalewayResponse`).
- The router normalises the path (strip any namespace prefix Scaleway prepends,
  trim trailing slash) before matching.
- Hoist the heavy imports (`@clerk/backend`, AWS SDK, storage factories) to the
  top of the module so they are loaded once per cold start, regardless of which
  route hits first. `getExerciseStorage`/`getJobStatusStore`/`getFileStorage`
  already memoise — fine as is.

### 2. Makefile

- Replace the `FUNCTIONS` list with `api ingest-worker`.
- The existing pattern rule `$(DIST)/%.zip: functions/%/handler.ts ...` keeps
  working (esbuild bundles `functions/api/handler.ts` which imports the siblings).
- Remove per-endpoint `VITE_*_URL` env exports in `build-frontend`; replace with
  a single `VITE_API_URL`.

### 3. Terraform (`terraform/main.tf`)

- Delete `scaleway_function` resources: `get_exercises`, `get_exercise`,
  `delete_exercise`, `post_ingest`, `get_ingest_status`.
- Add one `scaleway_function` `api`:
  - `memory_limit = 512` (max of current set; post-ingest needs it)
  - `timeout = 60`
  - `privacy = public`
  - `zip_file = .../dist/functions/api.zip`
- Keep `scaleway_function.ingest_worker` unchanged.
- Replace the 5 URL outputs with a single `api_url` output.

### 4. Frontend (`src/lib/api.ts`)

- Drop `VITE_GET_EXERCISES_URL`, `VITE_GET_EXERCISE_URL`,
  `VITE_DELETE_EXERCISE_URL`, `VITE_POST_INGEST_URL`,
  `VITE_GET_INGEST_STATUS_URL`.
- Keep only `VITE_API_URL` (existing fallback path is already in place).
- Each `xxxUrl()` reduces to `${API_BASE}/api/...` form.
- Update `env.d.ts` accordingly.

### 5. Dev server (`functions/dev-server.ts`)

No change required — Express already routes to each sub-handler and behaviour
is unchanged. Optional follow-up: swap the per-route `wrapHandler(...)` calls
for a single `app.all("/api/*", wrapHandler(apiHandle))` so dev exercises the
same router as production. Not needed for this plan.

### 6. Smoke test (`scripts/smoke-test-functions.sh`)

- Rewrite to hit the single `api_url` with different paths instead of 5
  separate function URLs.

### 7. Docs / README

- Note the single-function architecture. `min_scale` stays at 0 for now;
  revisit later if cold-start latency is still a problem after unification.

## Files touched

- add: `functions/api/handler.ts`
- edit: `Makefile`
- edit: `terraform/main.tf`
- edit: `src/lib/api.ts`, `env.d.ts`
- edit: `functions/dev-server.ts` (optional parity refactor, not required)
- edit: `scripts/smoke-test-functions.sh`
- edit: `README.md`, `docs/plans/2026-03-13-*` cross-refs if needed

## Testing

- Unit: add a small router test for `functions/api/handler.ts` asserting method/path → correct sub-handler is invoked (mock the sub-handlers).
- Existing handler unit tests remain valid (sub-handlers unchanged).
- E2E (playwright) and `smoke:functions` exercise the full path.

## Open questions

1. **Path prefix from Scaleway.** Scaleway serverless passes `event.path`
   verbatim from the request URL. When the function is invoked at
   `https://<id>.functions.fnc.fr-par.scw.cloud/api/exercises/abc`, is `path`
   = `/api/exercises/abc` or `/exercises/abc`? Need to confirm once deployed;
   router should tolerate both (strip optional leading `/api` or match on
   suffix).
2. **Keep per-endpoint log prefixes** (`[get-exercises]` etc.)? Yes — they're
   already inside the sub-handlers, so kept for free.
3. **Bundle size.** Unified bundle pulls AWS SDK + Clerk into one zip
   (OpenAI / Anthropic stay out — only `ingest-worker` imports the extraction
   provider). Verify the zip still fits under Scaleway's 100 MB limit after
   the first build (`ls -lh dist/functions/api.zip`); expected to be well
   under since each existing function is already small.
4. **Deprecate `VITE_*_URL` vars immediately or keep one release as fallback?**
   Recommend immediate removal since build is coupled to terraform outputs via
   Makefile (no external consumers).
