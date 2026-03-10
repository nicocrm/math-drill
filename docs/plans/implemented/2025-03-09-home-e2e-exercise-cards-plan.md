# Home E2E Test Plan (Exercise Cards)

**Parent**: [2025-03-09-mathdrill-remainder-implementation.md](./2025-03-09-mathdrill-remainder-implementation.md)  
**Date**: 2025-03-09  
**Status**: Implemented

## Overview

Add an E2E test to verify that when exercises exist, the home page displays exercise cards with title, metadata, and "Start" button. This complements the existing test that only covers the empty state.

## Current State

- `tests/e2e/home.spec.ts` has one test: "shows MathDrill heading and empty state"
- Home page fetches `GET /api/exercises` and renders cards when `exercises.length > 0`
- Playwright config uses `E2E_EXERCISES_DIR` (temp dir), so the real API returns `[]` — home shows empty state
- No test covers the non-empty path

## Approach: Mock GET /api/exercises

Use Playwright's `page.route()` to intercept `GET /api/exercises` and return `{ exercises: [mockExercise] }`. Same pattern as `session.spec.ts` and `results.spec.ts`.

## Implementation

### File: `tests/e2e/home.spec.ts`

#### New test: "shows exercise cards when exercises exist"

1. **Import mock fixture**:
   ```ts
   import mockExercise from "../fixtures/mock-exercise.json";
   ```

2. **Set up route mock** (before navigation):
   ```ts
   await page.route("**/api/exercises", async (route) => {
     if (route.request().method() === "GET" && !route.request().url().includes("/api/exercises/")) {
       await route.fulfill({ json: { exercises: [mockExercise] } });
     } else {
       await route.continue();
     }
   });
   ```

   **Note**: `GET /api/exercises` returns the list; `GET /api/exercises/[id]` returns a single exercise. The URL pattern `**/api/exercises` matches both. We need to mock only the list endpoint. A request to `http://localhost:3002/api/exercises` (no trailing path) is the list. A request to `http://localhost:3002/api/exercises/mock-exercise-1` is the single-exercise fetch. Check: `!route.request().url().endsWith("/api/exercises")` or `!/\/api\/exercises\/[^/]+$/.test(url)` — actually the list URL is exactly `/api/exercises` (no trailing slash). So we can match:
   - List: `url === baseURL + "/api/exercises"` or `url.match(/\/api\/exercises$/)?`
   - Single: `url.match(/\/api\/exercises\/[^/]+$/)?`

   Simpler: match `**/api/exercises` but exclude URLs that have an id segment. The list is `.../api/exercises` with no path after. So:
   ```ts
   const url = route.request().url();
   if (url.endsWith("/api/exercises") || url.match(/\/api\/exercises\?/)) {
     await route.fulfill({ json: { exercises: [mockExercise] } });
   } else {
     await route.continue();
   }
   ```
   Actually the list endpoint is just `/api/exercises` — no query. So `url.endsWith("/api/exercises")` or `new URL(url).pathname === "/api/exercises"`. Use that.

   ```ts
   await page.route("**/api/exercises", async (route) => {
     const pathname = new URL(route.request().url()).pathname;
     if (pathname === "/api/exercises") {
       await route.fulfill({ json: { exercises: [mockExercise] } });
     } else {
       await route.continue();
     }
   });
   ```

   When pathname is `/api/exercises`, it's the list. When it's `/api/exercises/mock-exercise-1`, pathname is `/api/exercises/mock-exercise-1`, so we continue (let real API handle, or we could also mock that — but for home page we only need the list). In E2E, the home page only calls `GET /api/exercises`. So we're good.

3. **Navigate to home**:
   ```ts
   await page.goto("/");
   ```

4. **Assert exercise card content**:
   - Card with title "Mock Math Exercise" visible
   - Metadata: "Algebra · 5 questions · 10 pts" (from mock-exercise)
   - "Start" button visible
   - "No exercise sets yet" not visible

   ```ts
   await expect(page.getByRole("heading", { name: "MathDrill" })).toBeVisible();
   await expect(page.getByText("Mock Math Exercise")).toBeVisible();
   await expect(page.getByText(/Algebra.*5 questions.*10 pts/)).toBeVisible();
   await expect(page.getByRole("link", { name: "Start" })).toBeVisible();
   await expect(page.getByText(/no exercise sets yet/i)).not.toBeVisible();
   ```

5. **Optional**: Assert "Upload more" button (shown when exercises exist)

   ```ts
   await expect(page.getByRole("link", { name: "Upload more" })).toBeVisible();
   ```

### Mock Data

`tests/fixtures/mock-exercise.json` already exists with:
- `id`: "mock-exercise-1"
- `title`: "Mock Math Exercise"
- `subject`: "Algebra"
- `questions`: 5 items, 2 pts each → 10 pts total

No fixture changes needed.

## Success Criteria

- [ ] `npm run test:e2e` passes
- [ ] New test "shows exercise cards when exercises exist" passes
- [ ] Existing test "shows MathDrill heading and empty state" still passes (no route mock, so real API returns `[]` from empty temp dir)

## Effort Estimate

**15–20 minutes** — Single test, established pattern from session/results specs.

## Notes

- The empty-state test does not set up a route mock, so it hits the real `GET /api/exercises`, which returns `[]` (E2E uses temp dir). Both tests remain valid.
- If we ever want to test "Start" navigation, we could add `await page.getByRole("link", { name: "Start" }).click()` and assert URL is `/session/mock-exercise-1`. Optional for this plan.
