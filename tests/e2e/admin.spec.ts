import { test, expect } from "@playwright/test";

test.describe("Admin", () => {
  test("shows Upload heading and sign-in prompt when unauthenticated", async ({ page }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Upload" })
    ).toBeVisible();
    await expect(
      page.getByText(/sign in|loading/i)
    ).toBeVisible();
  });
});
