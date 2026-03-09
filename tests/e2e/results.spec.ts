import { test, expect } from "@playwright/test";

test.describe("Results", () => {
  test("results page loads with session ID", async ({ page }) => {
    await page.goto("/results/test-session-456");
    await expect(
      page.getByRole("heading", { name: "Results" })
    ).toBeVisible();
    await expect(page.getByText(/session id: test-session-456/i)).toBeVisible();
    await expect(page.getByText("Not implemented")).toBeVisible();
  });
});
