import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScalewayEvent } from "../lib/scaleway";

// Mock all sub-handlers
vi.mock("../get-exercises/handler", () => ({
  handle: vi.fn().mockResolvedValue({ statusCode: 200, body: '{"route":"get-exercises"}' }),
}));
vi.mock("../get-exercise/handler", () => ({
  handle: vi.fn().mockResolvedValue({ statusCode: 200, body: '{"route":"get-exercise"}' }),
}));
vi.mock("../delete-exercise/handler", () => ({
  handle: vi.fn().mockResolvedValue({ statusCode: 200, body: '{"route":"delete-exercise"}' }),
}));
vi.mock("../post-ingest/handler", () => ({
  handle: vi.fn().mockResolvedValue({ statusCode: 200, body: '{"route":"post-ingest"}' }),
}));
vi.mock("../get-ingest-status/handler", () => ({
  handle: vi.fn().mockResolvedValue({ statusCode: 200, body: '{"route":"get-ingest-status"}' }),
}));

import { handle } from "./handler";
import { handle as handleGetExercises } from "../get-exercises/handler";
import { handle as handleGetExercise } from "../get-exercise/handler";
import { handle as handleDeleteExercise } from "../delete-exercise/handler";
import { handle as handlePostIngest } from "../post-ingest/handler";
import { handle as handleGetIngestStatus } from "../get-ingest-status/handler";

function makeEvent(method: string, path: string): ScalewayEvent {
  return {
    httpMethod: method,
    path,
    queryStringParameters: {},
    headers: {},
    body: "",
    isBase64Encoded: false,
  };
}

describe("api/handler router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes OPTIONS to CORS preflight (204)", async () => {
    const res = await handle(makeEvent("OPTIONS", "/api/exercises"));
    expect(res.statusCode).toBe(204);
    // Should NOT call any sub-handler
    expect(handleGetExercises).not.toHaveBeenCalled();
  });

  describe("GET /api/exercises", () => {
    it("routes to get-exercises handler", async () => {
      await handle(makeEvent("GET", "/api/exercises"));
      expect(handleGetExercises).toHaveBeenCalledTimes(1);
    });

    it("works with trailing slash", async () => {
      await handle(makeEvent("GET", "/api/exercises/"));
      // Trailing slash strips to "exercises" — routes to list
      expect(handleGetExercises).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/exercises/{id}", () => {
    it("routes to get-exercise handler", async () => {
      await handle(makeEvent("GET", "/api/exercises/abc123"));
      expect(handleGetExercise).toHaveBeenCalledTimes(1);
    });
  });

  describe("DELETE /api/exercises/{id}", () => {
    it("routes to delete-exercise handler", async () => {
      await handle(makeEvent("DELETE", "/api/exercises/abc123"));
      expect(handleDeleteExercise).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/ingest", () => {
    it("routes to post-ingest handler", async () => {
      await handle(makeEvent("POST", "/api/ingest"));
      expect(handlePostIngest).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/ingest/status", () => {
    it("routes to get-ingest-status handler", async () => {
      await handle(makeEvent("GET", "/api/ingest/status"));
      expect(handleGetIngestStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("path normalisation", () => {
    it("handles paths without /api prefix", async () => {
      await handle(makeEvent("GET", "/exercises"));
      expect(handleGetExercises).toHaveBeenCalledTimes(1);
    });

    it("handles paths without leading slash", async () => {
      await handle(makeEvent("GET", "exercises"));
      expect(handleGetExercises).toHaveBeenCalledTimes(1);
    });

    it("handles /exercises/{id} without /api prefix", async () => {
      await handle(makeEvent("GET", "/exercises/abc123"));
      expect(handleGetExercise).toHaveBeenCalledTimes(1);
    });

    it("handles /ingest/status without /api prefix", async () => {
      await handle(makeEvent("GET", "/ingest/status"));
      expect(handleGetIngestStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for unknown path", async () => {
      const res = await handle(makeEvent("GET", "/api/unknown"));
      expect(res.statusCode).toBe(404);
    });

    it("returns 404 for unknown method on known path", async () => {
      const res = await handle(makeEvent("PUT", "/api/exercises"));
      expect(res.statusCode).toBe(404);
    });
  });
});
