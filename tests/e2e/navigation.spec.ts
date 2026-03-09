import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("home links to admin", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /go to upload/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("admin has link back to home", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: /back to home/i }).click();
    await expect(page).toHaveURL("/");
  });
});
