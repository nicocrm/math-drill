import { verifyAuth } from "@math-drill/core/auth";
import { getExerciseStorage } from "../lib/env";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { jsonResponse, handleCorsPreflightMaybe } from "../lib/scaleway";

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
  const preflight = handleCorsPreflightMaybe(event);
  if (preflight) return preflight;

  const storage = getExerciseStorage();
  const mine = event.queryStringParameters?.mine;

  if (mine) {
    const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
    const req = new Request("http://localhost", {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    const auth = await verifyAuth(req);
    if (!auth.userId) {
      return jsonResponse(401, { error: "Authentication required" });
    }
    const exercises = await storage.listByUser(auth.userId);
    return jsonResponse(200, { exercises });
  }

  const exercises = await storage.list();
  return jsonResponse(200, { exercises });
}
