import { test, expect } from "@playwright/test";
import mockExercise from "../fixtures/mock-exercise.json" with { type: "json" };

const mockSession = {
  id: "test-session-456",
  exerciseSetId: "mock-exercise-1",
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  answers: [
    {
      questionId: "q1",
      value: ["b"],
      isCorrect: true,
      pointsAwarded: 2,
      workings: undefined,
    },
    {
      questionId: "q2",
      value: "true",
      isCorrect: true,
      pointsAwarded: 2,
      workings: undefined,
    },
    {
      questionId: "q3",
      value: "1/2",
      isCorrect: true,
      pointsAwarded: 2,
      workings: undefined,
    },
    {
      questionId: "q4",
      value: "8",
      isCorrect: true,
      pointsAwarded: 2,
      workings: undefined,
    },
    {
      questionId: "q5",
      value: "Because.",
      isCorrect: null,
      pointsAwarded: 0,
      workings: undefined,
    },
  ],
};

test.describe("Results", () => {
  test("results page shows Session not found when no session", async ({
    page,
  }) => {
    await page.goto("/results?id=nonexistent-session");
    await expect(
      page.getByRole("heading", { name: "Results" })
    ).toBeVisible();
    await expect(page.getByText("Session not found.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
  });

  test("results page shows ScoreBoard and review when session exists", async ({
    page,
  }) => {
    await page.route("**/api/exercises/mock-exercise-1", async (route) => {
      await route.fulfill({ json: mockExercise });
    });

    await page.goto("/");
    await page.evaluate((session) => {
      localStorage.setItem(`session-${session.id}`, JSON.stringify(session));
    }, mockSession);

    await page.goto(`/results?id=${mockSession.id}`);
    await expect(
      page.getByRole("heading", { name: "Results" })
    ).toBeVisible();
    await expect(page.getByText("By section")).toBeVisible();
    await expect(page.getByText("Section 1: 8/10 pts")).toBeVisible();
    await expect(page.getByText("Per-question review")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to Home" })).toBeVisible();
  });
});
