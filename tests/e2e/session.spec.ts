import { test, expect } from "@playwright/test";
import mockExercise from "../fixtures/mock-exercise.json" with { type: "json" };

test.describe("Session", () => {
  test("session page shows error when exercise not found", async ({ page }) => {
    await page.goto("/session?id=test-exercise-123");
    await expect(
      page.getByRole("heading", { name: "Exercise session" })
    ).toBeVisible();
    await expect(
      page.getByText(/exercise not found|loading/i)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Home" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("session page shows ExercisePlayer when exercise exists", async ({
    page,
  }) => {
    await page.route("**/api/exercises/mock-exercise-1", async (route) => {
      await route.fulfill({ json: mockExercise });
    });

    await page.goto("/session?id=mock-exercise-1");
    await expect(
      page.getByRole("heading", { name: "Exercise session" })
    ).toBeVisible();
    await expect(page.getByText(/loading|what is/i)).toBeVisible();
    await expect(page.getByText("What is")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
  });
});
