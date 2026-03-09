import { test, expect } from "@playwright/test";

test.describe("Admin", () => {
  test("shows Upload heading and DropZone", async ({ page }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Upload" })
    ).toBeVisible();
    await expect(page.getByText(/drag.*drop.*pdf/i)).toBeVisible();
  });
});
