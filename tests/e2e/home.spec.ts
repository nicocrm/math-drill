import { test, expect } from "@playwright/test";

test.describe("Home", () => {
  test("shows MathDrill heading and empty state", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "MathDrill" })
    ).toBeVisible();
    await expect(page.getByText(/no exercise sets yet/i)).toBeVisible();
  });
});
