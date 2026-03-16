# S3 Job Status + SQS Trigger + Lifecycle Cleanup Migration

**Date:** 2026-03-13  
**Status:** Implemented (2026-03-16)  
**Context:** NATS trigger for ingest-worker does not invoke the function; migration to SQS and S3-based job status removes NATS entirely.

---

## 1. Executive Summary

Replace NATS (KV + messaging) with:
- **Job status:** S3 JSON files (`status/{jobId}.json`)
- **Trigger:** Scaleway SQS queue → queue trigger on ingest-worker
- **Cleanup:** S3 lifecycle rules (delete by prefix after 48h)

This removes NATS as a dependency and uses a different trigger path that may work where NATS does not.

---

## 2. Current Architecture (to be replaced)

```
post-ingest                    ingest-worker
    │                               ▲
    ├─► NATS KV (job status)         │
    ├─► S3 intake/ (PDF)            │ NATS subject trigger (BROKEN)
    └─► NATS publish ingest.jobs ────┘
```

- **Job status:** NATS JetStream KV (`NatsJobStatusStore`)
- **Trigger:** NATS subject `ingest.jobs` → function trigger (not firing)
- **Storage:** S3 `intake/` (PDFs), S3 `exercises/{userId}/{id}.json` (completed)

---

## 3. Target Architecture

```
post-ingest                    ingest-worker
    │                               ▲
    ├─► S3 status/{jobId}.json      │
    ├─► S3 intake/ (PDF)            │ SQS queue trigger
    └─► SQS send message ──────────┘
```

- **Job status:** S3 `status/{jobId}.json` (JSON file per job)
- **Trigger:** Scaleway SQS queue `ingest-jobs` → queue trigger
- **Cleanup:** S3 lifecycle rules on `status/` and `intake/` (expire after 48h)

---

## 4. S3 Key Layout

| Prefix | Key pattern | Purpose | Lifecycle |
|--------|-------------|---------|-----------|
| `status/` | `{jobId}.json` | Job status (pending → done/error) | Expire 48h |
| `intake/` | `{jobId}-{filename}` | Uploaded PDF (input) | Expire 48h |
| `exercises/` | `{userId}/{exerciseId}.json` | Completed exercises | No expiry |

**Status file schema** (unchanged from `JobState`):

```json
{
  "status": "pending" | "processing" | "done" | "error",
  "progress": 0,
  "step": "saving" | "extracting" | "validating" | "saving_exercise" | "done",
  "exerciseId": "uuid",
  "questionCount": 42,
  "error": "optional error message"
}
```

---

## 5. Lifecycle Rules (Agreed: simpler than CRON)

**Rule 1: Status files**
- Prefix: `status/`
- Action: Expire (delete) after 48 hours
- Rationale: Status is only needed for frontend polling. Once done, user sees exercise. Pending/error jobs that never complete are cleaned automatically.

**Rule 2: Intake PDFs**
- Prefix: `intake/`
- Action: Expire (delete) after 48 hours
- Rationale: Worker downloads PDF, processes it, saves exercise. After completion we don't need the PDF. For failed jobs, the PDF is orphaned; 48h gives plenty of time for retries. No need to read file content—lifecycle is prefix + age only.

**Terraform:** Scaleway Object Storage supports lifecycle rules. Check provider docs for `scaleway_object_bucket_lifecycle_configuration` or `scaleway_object_bucket` nested `lifecycle_rule`. If not in Terraform, configure via [Scaleway console](https://www.scaleway.com/en/docs/object-storage/how-to/manage-lifecycle-rules/) or CLI; document the manual step.

---

## 6. SQS Queue Setup

**Terraform resources:**
- `scaleway_mnq_sqs` — SQS namespace (enables SQS for project; may be implicit)
- `scaleway_mnq_sqs_credentials` — credentials for functions (can_manage, can_publish, can_receive)
- `scaleway_mnq_sqs_queue` — queue named `ingest-jobs` (needs access_key/secret_key from credentials)
- `scaleway_function_trigger` — queue trigger with `scw_sqs_config` (queue name, mnq_project_id, mnq_region)

**Queue configuration:**
- `message_max_age`: 86400 (24h) — jobs should be processed within a day
- `visibility_timeout_seconds`: 300 — worker timeout is 5 min; message hidden while processing
- `receive_wait_time_seconds`: 5–10 — long polling to reduce empty receives

**Trigger:** `scw_sqs_config` with `queue` name and `mnq_project_id` / `mnq_region`.

---

## 7. Code Changes

### 7.1 New: S3 Job Status Store

Create `packages/core/src/jobStatus/s3JobStatusStore.ts`:

```typescript
export class S3JobStatusStore implements JobStatusStore {
  // Uses S3 GetObject/PutObject for status/{jobId}.json
  // get(), set(), updateProgress() — same interface as NatsJobStatusStore
}
```

- Bucket + prefix `status/` from env
- Same `JobState` schema
- `updateProgress`: read current, merge, overwrite (S3 PUT is atomic per object)

### 7.2 post-ingest

- Remove NATS dependency (`nats` package, `NATS_URL`, `NATS_CREDS`)
- Add SQS client (`@aws-sdk/client-sqs` or Scaleway SQS SDK)
- Replace `getJobStatusStore()` with `S3JobStatusStore` (or env-based selection)
- Replace `nc.publish("ingest.jobs", ...)` with `sqs.sendMessage(QueueUrl, Body: JSON.stringify(payload))`
- Env: `SQS_QUEUE_URL` or `SQS_QUEUE_NAME` + endpoint

### 7.3 get-ingest-status

- Replace `getJobStatusStore()` with `S3JobStatusStore`
- Read `status/{jobId}.json` from S3
- If not found: return 404 with `{ status: "pending", progress: 0, error: "Job not found" }` (same as today for KV miss)

### 7.4 ingest-worker

- Replace NATS trigger with SQS queue trigger
- Event format: SQS delivers `{ body: string }` — parse JSON, same `IngestPayload` shape
- Replace `getJobStatusStore()` with `S3JobStatusStore`
- No code change to `handleIngest()` logic—only storage backend

### 7.5 Remove

- `NatsJobStatusStore`
- `scaleway_mnq_nats_account`, `scaleway_mnq_nats_credentials`
- `scaleway_function_trigger` (NATS)
- `NATS_URL`, `NATS_CREDS` from namespace env
- `nats` package from dependencies

---

## 8. Terraform Changes

| Action | Resource |
|--------|----------|
| Add | `scaleway_mnq_sqs_*` — SQS namespace/credentials/queue |
| Add | `scaleway_function_trigger` — SQS trigger (replace NATS) |
| Add | `scaleway_object_bucket_lifecycle_configuration` (or manual) |
| Remove | `scaleway_mnq_nats_account`, `scaleway_mnq_nats_credentials` |
| Remove | NATS trigger |
| Update | `scaleway_function_namespace` — remove NATS_URL, NATS_CREDS; add SQS_* |

**IAM:** Functions need SQS send/receive. Check if `ObjectStorageFullAccess` covers SQS or if `MessagingAndQueuing*` is needed.

---

## 9. Local Development

**Current:** Docker NATS + `dev-worker` subscribes to `ingest.jobs`.

**New options:**
1. **Local SQS:** Scaleway doesn't offer local SQS. Use LocalStack or similar for SQS emulation.
2. **Bypass queue:** `dev-worker` could poll S3 `status/` for new pending jobs (hacky).
3. **Hybrid:** Keep a minimal NATS or in-memory queue for local dev only; production uses SQS.

**Recommendation:** Use LocalStack SQS for local dev, or a simple HTTP-triggered worker (post-ingest calls worker URL directly in dev). Document in README.

---

## 10. Migration / Rollout

1. **Deploy SQS + lifecycle** — add resources, don't remove NATS yet
2. **Deploy new code** — post-ingest publishes to SQS *and* NATS (dual-write) if desired for safety, or SQS only
3. **Switch trigger** — remove NATS trigger, add SQS trigger
4. **Verify** — upload PDF, confirm worker runs, status updates, exercise appears
5. **Remove NATS** — delete NATS resources, remove NATS code

**Data migration:** No migration. Job status in NATS KV is ephemeral (TTL). Old pending jobs in KV will expire. New jobs use S3.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SQS trigger also doesn't fire | Same as NATS—open support ticket. Fallback: Option 1 (HTTP invoke) from prior discussion |
| Lifecycle deletes too aggressively | 48h is conservative; jobs complete in minutes. Can increase to 72h if needed |
| S3 eventual consistency | New object PUT is read-after-write consistent. No issue for status files |
| Local dev complexity | LocalStack or HTTP bypass; document clearly |

---

## 12. Verification Checklist

- [x] post-ingest creates `status/{jobId}.json` with `pending`
- [x] post-ingest sends message to SQS queue (or INGEST_WORKER_URL for local dev)
- [x] ingest-worker is invoked by SQS trigger (or HTTP for local dev)
- [x] ingest-worker updates status file at each step
- [x] get-ingest-status returns status from S3
- [x] Frontend polls, sees progress, sees done + exerciseId (no change)
- [x] Lifecycle rules delete `status/` and `intake/` objects after 48h (2 days)
- [x] NATS resources removed
- [x] Local dev documented (HTTP-triggered worker, INGEST_WORKER_URL)

---

## 13. File Summary

| File | Action |
|------|--------|
| `packages/core/src/jobStatus/s3JobStatusStore.ts` | Create |
| `packages/core/src/jobStatus/natsJobStatusStore.ts` | Remove |
| `functions/lib/env.ts` | Use S3JobStatusStore when STORAGE=s3; remove NATS |
| `functions/post-ingest/handler.ts` | SQS send instead of NATS publish |
| `functions/get-ingest-status/handler.ts` | No logic change (env selects store) |
| `functions/ingest-worker/handler.ts` | Parse SQS event body; no logic change |
| `terraform/main.tf` | SQS resources, lifecycle, trigger swap |
| `functions/dev-worker.ts` | Adapt for local SQS or HTTP |
| `docker-compose.yml` | Replace NATS with LocalStack (optional) |
