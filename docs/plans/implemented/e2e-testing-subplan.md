# Sub-Plan: End-to-End Testing

> **Parent:** [mathdrill-plan.md](../mathdrill-plan.md)  
> **Purpose:** Establish an E2E testing framework and test suite that validates user flows across pages, API routes, and components. Tests are layered so that scaffolding-complete tests run immediately; feature-complete tests are added as each capability ships.

---

## Scope

**In scope:**
- Playwright-based E2E test framework
- Tests for navigation, page rendering, and API responses
- Tests for ingestion flow (upload, status, redirect)
- Tests for exercise session flow (load, answer, submit, results)
- CI-friendly configuration (headless, deterministic where possible)

**Out of scope:**
- Unit tests (separate plan if needed)
- Visual regression / screenshot comparison
- Performance benchmarks
- Testing extraction provider API (Claude/OpenAI) or PDF extraction logic directly (those are integration tests; E2E assumes mocked or real backend)

---

## Prerequisites

- [Initial Scaffolding Sub-Plan](./initial-scaffolding-subplan.md) completed
- Node.js 18+
- npm or pnpm

---

## Tool Choice: Playwright

Use **Playwright** for E2E testing. It is the recommended choice for Next.js, supports modern browsers, has built-in auto-waiting and retries, and integrates well with CI.

```bash
npm install -D @playwright/test
npx playwright install
```

Configuration: `playwright.config.ts` at project root.

---

## Test Structure

```
tests/
├── e2e/
│   ├── navigation.spec.ts      # Cross-page navigation (scaffolding-ready)
│   ├── home.spec.ts            # Home page behavior (scaffolding-ready)
│   ├── admin.spec.ts           # Admin/upload page (scaffolding + ingestion)
│   ├── session.spec.ts         # Exercise player flow (requires player)
│   └── results.spec.ts         # Results page (requires session flow)
├── fixtures/
│   └── mock-exercise.json      # Minimal valid ExerciseSet for session/results tests
└── playwright.config.ts        # (or at root)
```

---

## What Can Be Implemented Upon Scaffolding Completion

Once the [Initial Scaffolding Sub-Plan](./initial-scaffolding-subplan.md) is complete, the following E2E tests can be implemented and will pass:

| Test File | Tests | Depends On |
|-----------|-------|------------|
| `navigation.spec.ts` | Home → Admin, Admin → Home, links resolve | Placeholder pages, `Link` components |
| `home.spec.ts` | "MathDrill" heading, "No exercise sets yet", link to admin | Home page placeholder |
| `admin.spec.ts` (partial) | "Upload" heading, DropZone stub visible | Admin page, DropZone stub |
| `api-smoke.spec.ts` | GET `/api/exercises` → `{ exercises: [] }`, GET `/api/ingest/status` → valid JSON | Placeholder API routes |
| `session.spec.ts` (partial) | `/session/foo` loads, shows "Exercise session" and exerciseId | Session page placeholder |
| `results.spec.ts` (partial) | `/results/bar` loads, shows "Results" and sessionId | Results page placeholder |

**Scaffolding-ready test examples:**

```typescript
// tests/e2e/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home links to admin', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /go to upload/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('admin has link back to home', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /home/i }).click();
    await expect(page).toHaveURL('/');
  });
});
```

```typescript
// tests/e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Home', () => {
  test('shows MathDrill heading and empty state', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'MathDrill' })).toBeVisible();
    await expect(page.getByText(/no exercise sets yet/i)).toBeVisible();
  });
});
```

```typescript
// tests/e2e/api-smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('API smoke', () => {
  test('GET /api/exercises returns exercises array', async ({ request }) => {
    const res = await request.get('/api/exercises');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('exercises');
    expect(Array.isArray(body.exercises)).toBeTruthy();
  });

  test('GET /api/ingest/status returns status object', async ({ request }) => {
    const res = await request.get('/api/ingest/status?jobId=mock-job-123');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});
```

---

## Full E2E Test Matrix (Feature-Complete)

| Flow | Test | Requires |
|------|------|----------|
| **Navigation** | All links resolve, no 404s | Scaffolding |
| **Home** | Lists exercise sets when present; empty state when none | `GET /api/exercises` with real data |
| **Admin** | DropZone accepts PDF, POST ingest, SSE/poll status, redirect on done | Ingestion pipeline |
| **Session** | Load exercise, answer questions, submit, navigate to results | Exercise player, validation, sessionStore |
| **Results** | Score display, per-question review, "Try again" / "Back to home" | ScoreBoard, session from localStorage |

---

## Implementation Steps

### 1. Install Playwright and Create Config

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

Add script to `package.json`:

```json
"test:e2e": "playwright test"
```

---

### 2. Scaffolding-Ready Tests (Implement First)

Create the test files listed in "What Can Be Implemented Upon Scaffolding Completion" above. These should pass as soon as scaffolding is verified.

---

### 3. Mock Exercise Fixture

Create `tests/fixtures/mock-exercise.json` with a minimal valid `ExerciseSet` (one question of each type if desired). Use this to seed `exercises/` or mock `GET /api/exercises/[id]` for session/results tests once those features exist.

---

### 4. Ingestion Flow Tests (After Ingestion Pipeline)

- POST PDF to `/api/ingest`, assert `jobId` in response
- Poll or SSE `/api/ingest/status?jobId=...` until `status: "done"`
- Verify redirect or link to `/session/<exerciseId>`

**Note:** PDF upload in E2E requires a real or fixture PDF. Use a small fixture PDF in `tests/fixtures/sample.pdf` to avoid flakiness.

---

### 5. Session Flow Tests (After Exercise Player)

- Navigate to `/session/<id>` with mock exercise
- Fill answers for numeric, multiple_choice, true_false
- Submit and advance through questions
- Verify redirect to `/results/<sessionId>`

---

### 6. Results Flow Tests (After ScoreBoard)

- Navigate to `/results/<sessionId>` (session must exist in localStorage or be seeded)
- Verify score display, section breakdown, per-question review
- Test "Try again" and "Back to home" buttons

---

## CI Integration

- Run `npm run test:e2e` in CI after `npm run build` (or use `webServer` to start `next dev`).
- Playwright's `webServer` option starts the dev server automatically; for production-like testing, consider `next start` with a prior `next build`.
- Ensure `EXERCISES_DIR` and `INTAKE_DIR` point to temp directories in CI to avoid polluting the repo.

---

## Completion Criteria

- [ ] Playwright installed and configured
- [ ] `npm run test:e2e` runs successfully
- [ ] Scaffolding-ready tests pass (navigation, home, admin stub, API smoke, session/results placeholders)
- [ ] Test structure documented for follow-on feature tests
- [ ] CI script or instruction for running E2E tests

---

## Follow-On Work

As each feature ships, add or extend E2E tests:

1. **Ingestion** → admin flow tests (upload, status, redirect)
2. **Exercise player** → session flow tests (answer, submit, progress)
3. **Results** → results flow tests (score, review, buttons)
4. **Math rendering** → optional: assert KaTeX-rendered elements (e.g. `data-katex` or specific DOM structure)

---

## Estimated Effort

- Scaffolding-ready tests: ~1 hour
- Full E2E suite (all flows): ~3–4 hours after features are implemented
