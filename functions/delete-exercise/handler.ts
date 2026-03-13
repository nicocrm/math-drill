import { verifyAuth, requireAuth, HttpError } from "@math-drill/core/auth";
import { getExerciseStorage } from "../lib/env";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { jsonResponse } from "../lib/scaleway";

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
  const req = new Request("http://localhost", {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  try {
    const auth = await verifyAuth(req);
    requireAuth(auth);

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

    if (exercise.createdBy && exercise.createdBy !== auth.userId) {
      return jsonResponse(403, { error: "Not authorized to delete this exercise" });
    }

    await storage.delete(id);
    return jsonResponse(200, { ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.statusCode, { error: err.message });
    }
    throw err;
  }
}
