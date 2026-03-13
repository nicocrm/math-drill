# Multi-URL API Configuration

**Date:** 2026-03-13  
**Status:** Implemented

## Problem

Production deploys each API endpoint as a separate Scaleway serverless function with its own URL. The current `VITE_API_URL` + path pattern assumes a single base URL, which does not match the production architecture.

## Goal

Support both:

1. **Unified mode (local dev)** — Single base URL (Express at `localhost:3001`), path-based routing
2. **Multi-URL mode (production)** — Five separate env vars, one per function URL

## Endpoint Mapping

| Endpoint | Method | Unified path | Multi-URL env var | Production URL format |
|----------|--------|--------------|-------------------|------------------------|
| List exercises | GET | `/api/exercises` | `VITE_GET_EXERCISES_URL` | `{url}` or `{url}?mine=1` |
| Get exercise | GET | `/api/exercises/:id` | `VITE_GET_EXERCISE_URL` | `{url}/{id}` |
| Delete exercise | DELETE | `/api/exercises/:id` | `VITE_DELETE_EXERCISE_URL` | `{url}/{id}` |
| Post ingest | POST | `/api/ingest` | `VITE_POST_INGEST_URL` | `{url}` |
| Get ingest status | GET | `/api/ingest/status?jobId=...` | `VITE_GET_INGEST_STATUS_URL` | `{url}?jobId=...` |

## Resolution Logic

- **Unified mode:** If no endpoint-specific env vars are set, use `VITE_API_URL` (or empty) + path for all calls.
- **Multi-URL mode:** If any `VITE_*_URL` is set, use the specific URL for that endpoint. Fall back to `VITE_API_URL` + path for any endpoint whose specific var is unset (allows partial migration).

For local dev, `VITE_API_URL` alone is sufficient. No endpoint-specific vars needed.

## Implementation Tasks

### 1. Refactor `src/lib/api.ts`

Replace the generic `apiUrl(path)` with endpoint-specific functions:

```typescript
// Unified base (used when no endpoint-specific URL is set)
const API_BASE = import.meta.env.VITE_API_URL || "";

// Endpoint-specific URLs (production)
const GET_EXERCISES_URL = import.meta.env.VITE_GET_EXERCISES_URL;
const GET_EXERCISE_URL = import.meta.env.VITE_GET_EXERCISE_URL;
const DELETE_EXERCISE_URL = import.meta.env.VITE_DELETE_EXERCISE_URL;
const POST_INGEST_URL = import.meta.env.VITE_POST_INGEST_URL;
const GET_INGEST_STATUS_URL = import.meta.env.VITE_GET_INGEST_STATUS_URL;

export function getExercisesUrl(mine?: boolean): string {
  if (GET_EXERCISES_URL) return mine ? `${GET_EXERCISES_URL}?mine=1` : GET_EXERCISES_URL;
  return `${API_BASE}/api/exercises${mine ? "?mine=1" : ""}`;
}

export function getExerciseUrl(id: string): string {
  if (GET_EXERCISE_URL) return `${GET_EXERCISE_URL}/${id}`;
  return `${API_BASE}/api/exercises/${id}`;
}

export function deleteExerciseUrl(id: string): string {
  if (DELETE_EXERCISE_URL) return `${DELETE_EXERCISE_URL}/${id}`;
  return `${API_BASE}/api/exercises/${id}`;
}

export function postIngestUrl(): string {
  if (POST_INGEST_URL) return POST_INGEST_URL;
  return `${API_BASE}/api/ingest`;
}

export function getIngestStatusUrl(jobId: string): string {
  if (GET_INGEST_STATUS_URL) return `${GET_INGEST_STATUS_URL}?jobId=${encodeURIComponent(jobId)}`;
  return `${API_BASE}/api/ingest/status?jobId=${encodeURIComponent(jobId)}`;
}

export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
```

**Note:** Remove trailing slashes from env var values in production; the code appends `/{id}` or `?...` as needed.

### 2. Update call sites

| File | Current | New |
|------|---------|-----|
| `Home.tsx` | `apiUrl("/api/exercises")` | `getExercisesUrl()` |
| `AdminUpload.tsx` | `apiUrl("/api/exercises?mine=1")` | `getExercisesUrl(true)` |
| `AdminUpload.tsx` | `apiUrl(\`/api/exercises/${id}\`)` (GET) | `getExerciseUrl(id)` |
| `AdminUpload.tsx` | `apiUrl(\`/api/exercises/${id}\`)` (DELETE) | `deleteExerciseUrl(id)` |
| `ExercisePlayer.tsx` | `apiUrl(\`/api/exercises/${exerciseId}\`)` | `getExerciseUrl(exerciseId)` |
| `Results.tsx` | `apiUrl(\`/api/exercises/${exerciseSetId}\`)` | `getExerciseUrl(exerciseSetId)` |
| `DropZone.tsx` | `apiUrl("/api/ingest")` | `postIngestUrl()` |
| `IngestionStatus.tsx` | `apiUrl(\`/api/ingest/status?jobId=...\`)` | `getIngestStatusUrl(jobId)` |

### 3. Update `.env.example`

```bash
# API base URL — unified mode (local dev, static build preview)
# Set to http://localhost:3001 when testing static build locally
# VITE_API_URL=http://localhost:3001

# Production — endpoint-specific URLs (Scaleway function URLs from Terraform)
# When set, these override VITE_API_URL for each endpoint
# VITE_GET_EXERCISES_URL=https://...
# VITE_GET_EXERCISE_URL=https://...
# VITE_DELETE_EXERCISE_URL=https://...
# VITE_POST_INGEST_URL=https://...
# VITE_GET_INGEST_STATUS_URL=https://...
```

### 4. Update README

- Add the five env vars to the Environment Variables table
- Clarify in "Testing the Static Build Locally" that `VITE_API_URL=http://localhost:3001` uses unified mode
- Add a "Production deployment" subsection under "Deployment" describing how to set the five endpoint URLs from Terraform outputs

### 5. E2E tests

E2E tests run against the dev server (Vite + Express). No env vars needed — `VITE_API_URL` is empty, so `apiUrl` resolves to relative paths (e.g. `/api/exercises`) which the Vite proxy forwards to Express. No changes required to E2E tests unless we explicitly test multi-URL mode (optional, not in scope for initial implementation).

## Local Development Workflows

| Scenario | Config | Result |
|----------|--------|--------|
| `npm run dev` | No env vars | `apiUrl` → `/api/exercises` etc. Vite proxies `/api` to Express. ✓ |
| `npm run dev` | `VITE_API_URL=http://localhost:3001` | Same as above (overkill but works) |
| `npm run build` + `npm run preview` + `npm run dev:api` | `VITE_API_URL=http://localhost:3001` at build time | Static build calls localhost:3001. ✓ |
| Production build | All five `VITE_*_URL` set | Each endpoint calls its Scaleway function. ✓ |

## Verification

- [x] Local dev (`npm run dev`) — list exercises, start session, view results
- [x] Static build preview with API — `VITE_API_URL=http://localhost:3001 npm run build`, `npm run preview`, `npm run dev:api` in another terminal
- [ ] Production build — set all five env vars, build, deploy, full E2E against deployed API
