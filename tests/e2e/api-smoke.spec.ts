import { test, expect } from "@playwright/test";

test.describe("API smoke", () => {
  test("GET /api/exercises returns exercises array", async ({ request }) => {
    const res = await request.get("/api/exercises");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("exercises");
    expect(Array.isArray(body.exercises)).toBeTruthy();
  });

  test("GET /api/ingest/status returns status object", async ({ request }) => {
    const res = await request.get("/api/ingest/status?jobId=mock-job-123");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });
});
