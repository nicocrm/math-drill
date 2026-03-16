import { verifyAuth } from "@math-drill/core/auth";
import { getExerciseStorage } from "../lib/env";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { jsonResponse, handleCorsPreflightMaybe } from "../lib/scaleway";

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
  const t0 = Date.now();
  const preflight = handleCorsPreflightMaybe(event);
  if (preflight) return preflight;

  const t1 = Date.now();
  const storage = getExerciseStorage();
  const mine = event.queryStringParameters?.mine;

  if (mine) {
    const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
    const req = new Request("http://localhost", {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    const auth = await verifyAuth(req);
    const t2 = Date.now();
    if (!auth.userId) {
      console.log(`[get-exercises] mine=1 auth=fail ${t2 - t0}ms total`);
      return jsonResponse(401, { error: "Authentication required" });
    }
    const exercises = await storage.listByUser(auth.userId);
    const t3 = Date.now();
    console.log(`[get-exercises] mine=1 init=${t1 - t0}ms auth=${t2 - t1}ms storage=${t3 - t2}ms total=${t3 - t0}ms count=${exercises.length}`);
    return jsonResponse(200, { exercises });
  }

  const exercises = await storage.list();
  const t2 = Date.now();
  console.log(`[get-exercises] mine=0 init=${t1 - t0}ms storage=${t2 - t1}ms total=${t2 - t0}ms count=${exercises.length}`);
  return jsonResponse(200, { exercises });
}
