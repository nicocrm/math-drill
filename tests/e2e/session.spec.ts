import { test, expect } from "@playwright/test";

test.describe("Session", () => {
  test("session page loads with exercise ID", async ({ page }) => {
    await page.goto("/session/test-exercise-123");
    await expect(
      page.getByRole("heading", { name: "Exercise session" })
    ).toBeVisible();
    await expect(page.getByText(/exercise id: test-exercise-123/i)).toBeVisible();
    await expect(page.getByText("Not implemented")).toBeVisible();
  });
});
