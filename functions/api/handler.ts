/**
 * Unified API handler — routes all HTTP endpoints to the appropriate sub-handler.
 *
 * Routes:
 *   OPTIONS *                   → CORS preflight
 *   GET    /api/exercises        → get-exercises
 *   GET    /api/exercises/{id}   → get-exercise
 *   DELETE /api/exercises/{id}   → delete-exercise
 *   POST   /api/ingest           → post-ingest
 *   GET    /api/ingest/status    → get-ingest-status
 */

// Hoist heavy imports so they are loaded once per cold start, regardless of
// which route is hit first.
import { handle as handleGetExercises } from "../get-exercises/handler";
import { handle as handleGetExercise } from "../get-exercise/handler";
import { handle as handleDeleteExercise } from "../delete-exercise/handler";
import { handle as handlePostIngest } from "../post-ingest/handler";
import { handle as handleGetIngestStatus } from "../get-ingest-status/handler";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { handleCorsPreflightMaybe, jsonResponse } from "../lib/scaleway";

/**
 * Normalise the request path:
 *  - strip leading/trailing slashes
 *  - strip optional leading "api" segment (Scaleway may or may not include it)
 * Returns a clean path without leading slash, e.g. "exercises/abc" or "ingest/status"
 */
function normalisePath(raw: string): string {
  // Remove leading and trailing slashes
  let p = raw.replace(/^\/+|\/+$/g, "");
  // Strip optional leading "api/" segment
  if (p === "api" || p.startsWith("api/")) {
    p = p.slice(p.indexOf("/") + 1);
    if (p === "api") p = ""; // edge case: "api" with no trailing slash
  }
  return p;
}

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
  // Handle CORS preflight for all routes
  const preflight = handleCorsPreflightMaybe(event);
  if (preflight) return preflight;

  const method = (event.httpMethod ?? "GET").toUpperCase();
  const path = normalisePath(event.path ?? "");

  // GET /api/ingest/status
  if (method === "GET" && path === "ingest/status") {
    return handleGetIngestStatus(event);
  }

  // POST /api/ingest
  if (method === "POST" && path === "ingest") {
    return handlePostIngest(event);
  }

  // GET /api/exercises  (exact, no trailing segment)
  if (method === "GET" && path === "exercises") {
    return handleGetExercises(event);
  }

  // GET /api/exercises/{id}
  if (method === "GET" && path.startsWith("exercises/")) {
    return handleGetExercise(event);
  }

  // DELETE /api/exercises/{id}
  if (method === "DELETE" && path.startsWith("exercises/")) {
    return handleDeleteExercise(event);
  }

  return jsonResponse(404, { error: "Not found" });
}
