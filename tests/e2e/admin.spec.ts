import { test, expect } from "@playwright/test";
import mockExercise from "../fixtures/mock-exercise.json";

const MOCK_JOB_ID = "e2e-job-123";
const MOCK_EXERCISE_ID = "mock-exercise-1";

test.describe("Admin", () => {
  test("shows Upload heading and DropZone", async ({ page }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Upload" })
    ).toBeVisible();
    await expect(page.getByText(/drag.*drop.*pdf/i)).toBeVisible();
  });

  test("full ingestion flow: upload, poll, redirect", async ({ page }) => {
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

    await page.route("**/api/exercises/mock-exercise-1", async (route) => {
      await route.fulfill({ json: mockExercise });
    });

    await page.goto("/admin");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n"),
    });

    await expect(page).toHaveURL(/\/session\/mock-exercise-1/, {
      timeout: 5000,
    });
    await expect(
      page.getByRole("heading", { name: "Exercise session" })
    ).toBeVisible();
    await expect(page.getByText("What is")).toBeVisible();
  });
});
