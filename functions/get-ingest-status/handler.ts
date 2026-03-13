import { getJobStatusStore } from "../lib/env";
import type { ScalewayEvent, ScalewayResponse } from "../lib/scaleway";
import { jsonResponse } from "../lib/scaleway";

export async function handle(
  event: ScalewayEvent
): Promise<ScalewayResponse> {
  const jobId = event.queryStringParameters?.jobId;

  if (!jobId) {
    return jsonResponse(400, { error: "Missing jobId query parameter" });
  }

  const jobStore = getJobStatusStore();
  const job = await jobStore.get(jobId);

  if (!job) {
    return jsonResponse(404, {
      status: "pending",
      progress: 0,
      error: "Job not found",
    });
  }

  return jsonResponse(200, {
    status: job.status,
    ...(job.progress !== undefined && { progress: job.progress }),
    ...(job.step && { step: job.step }),
    ...(job.exerciseId && { exerciseId: job.exerciseId }),
    ...(job.questionCount !== undefined && { questionCount: job.questionCount }),
    ...(job.error && { error: job.error }),
  });
}
