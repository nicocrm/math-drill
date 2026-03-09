import { test, expect } from "@playwright/test";
import mockExercise from "../fixtures/mock-exercise.json";

test.describe("Home", () => {
  test("shows MathDrill heading and empty state", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "MathDrill" })
    ).toBeVisible();
    await expect(page.getByText(/no exercise sets yet/i)).toBeVisible();
  });

  test("shows exercise cards when exercises exist", async ({ page }) => {
    await page.route("**/api/exercises", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/api/exercises") {
        await route.fulfill({ json: { exercises: [mockExercise] } });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "MathDrill" })).toBeVisible();
    await expect(page.getByText("Mock Math Exercise")).toBeVisible();
    await expect(
      page.getByText(/Algebra.*5 questions.*10 pts/)
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start" })).toBeVisible();
    await expect(page.getByText(/no exercise sets yet/i)).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Upload more" })).toBeVisible();
  });
});
