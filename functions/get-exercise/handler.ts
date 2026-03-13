import { getExerciseStorage } from "../lib/env";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { jsonResponse, handleCorsPreflightMaybe } from "../lib/scaleway";

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
  const preflight = handleCorsPreflightMaybe(event);
  if (preflight) return preflight;

  // Extract id from path: /exercises/{id} or /{id}
  const segments = event.path.replace(/^\/+|\/+$/g, "").split("/");
  const id = segments[segments.length - 1];

  if (!id) {
    return jsonResponse(400, { error: "Missing exercise id" });
  }

  const storage = getExerciseStorage();
  const exercise = await storage.get(id);

  if (!exercise) {
    return jsonResponse(404, { error: "Not found" });
  }

  return jsonResponse(200, exercise);
}
