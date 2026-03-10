# Ingestion E2E Test Plan (Mocked API)

**Parent**: [2025-03-09-mathdrill-remainder-implementation.md](./2025-03-09-mathdrill-remainder-implementation.md)  
**Date**: 2025-03-09  
**Status**: Implemented

## Overview

Extend the admin E2E tests to cover the full ingestion flow: upload PDF → poll status → redirect to session. The ingest and status APIs are **mocked** so the test does not depend on real PDF parsing or LLM extraction. This verifies that DropZone, IngestionStatus, and the redirect flow work correctly.

## Current State

- `tests/e2e/admin.spec.ts` has one test: "shows Upload heading and DropZone"
- No test exercises the upload → status → redirect flow
- Real ingestion requires PDF + Claude/OpenAI; impractical for CI

## Approach: Route Interception

Use Playwright's `page.route()` to intercept:

1. `POST /api/ingest` → return `{ jobId: "e2e-job-123" }`
2. `GET /api/ingest/status?jobId=e2e-job-123` → return `{ status: "done", exerciseId: "mock-exercise-1", progress: 100 }`

The client never hits the real server; the mock fulfills the request. No PDF content or extraction logic is exercised.

## Implementation

### File: `tests/e2e/admin.spec.ts`

#### New test: "full ingestion flow: upload, poll, redirect"

1. **Set up route mocks** (before navigation):

   ```ts
   const MOCK_JOB_ID = "e2e-job-123";
   const MOCK_EXERCISE_ID = "mock-exercise-1";

   await page.route("**/api/ingest", async (route) => {
     if (route.request().method() === "POST") {
       await route.fulfill({ json: { jobId: MOCK_JOB_ID } });
     } else {
       await route.continue();
     }
   });

   await page.route("**/api/ingest/status*", async (route) => {
     const url = new URL(route.request().url());
     const jobId = url.searchParams.get("jobId");
     if (jobId === MOCK_JOB_ID) {
       await route.fulfill({
         json: {
           status: "done",
           exerciseId: MOCK_EXERCISE_ID,
           progress: 100,
         },
       });
     } else {
       await route.continue();
     }
   });
   ```

2. **Navigate to admin**:
   ```ts
   await page.goto("/admin");
   ```

3. **Trigger file upload**:
   - DropZone uses `react-dropzone` with a hidden `<input type="file" />`
   - Use `page.locator('input[type="file"]').setInputFiles(...)` to simulate file selection
   - Create a minimal file: `{ name: "test.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") }` — content is irrelevant since the mock intercepts

   ```ts
   const fileInput = page.locator('input[type="file"]');
   await fileInput.setInputFiles({
     name: "test.pdf",
     mimeType: "application/pdf",
     buffer: Buffer.from("%PDF-1.4\n"),
   });
   ```

4. **Wait for redirect**:
   - IngestionStatus polls, gets `done`, then `router.push(\`/session/${exerciseId}\`)`
   - Assert URL changes to `/session/mock-exercise-1`

   ```ts
   await expect(page).toHaveURL(/\/session\/mock-exercise-1/, { timeout: 5000 });
   ```

5. **Optional assertions**:
   - Session page heading visible
   - ExercisePlayer content (e.g. "What is" from mock-exercise) visible

### Edge Cases

- **Poll timing**: IngestionStatus polls every 1s. The first poll may occur before we set up the mock if we navigate first. Set up routes *before* `page.goto("/admin")` so they are in place when the client makes requests.
- **Multiple status polls**: The mock returns `done` on every call. That's fine — the client stops polling when it sees `done`.
- **File input visibility**: The input may be `display: none` or `visibility: hidden`. Playwright's `setInputFiles` works on hidden inputs. If the input is inside a dropzone that requires click-to-open, we may need to click the dropzone first to "activate" it — but `setInputFiles` on the input directly often works without that.

### Alternative: Click to Open File Picker

If `setInputFiles` on the hidden input fails (e.g. react-dropzone prevents it):

```ts
// Trigger the file dialog by clicking the dropzone, then handle the file chooser
const fileChooserPromise = page.waitForEvent("filechooser");
await page.getByText(/drag.*drop|or click to browse/i).click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles({
  name: "test.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n"),
});
```

Use this if the direct `setInputFiles` approach doesn't work.

## Success Criteria

- [x] `npm run test:e2e` passes
- [x] New test "full ingestion flow: upload, poll, redirect" passes
- [x] Existing test "shows Upload heading and DropZone" still passes
- [x] No external dependencies (API keys, network) required

## Effort Estimate

**1–2 hours** — Route setup is straightforward; file upload triggering may require iteration if react-dropzone behaves differently than expected.

## Out of Scope

- Real PDF upload and extraction (requires LLM, not suitable for E2E)
- SSE (EventSource) path — IngestionStatus uses polling; mock supports both
- Error-path testing (e.g. status returns `error`) — can be added later as a separate test
