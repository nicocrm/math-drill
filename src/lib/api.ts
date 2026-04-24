export const getExercisesUrl = (mine?: boolean) =>
  `/api/exercises${mine ? "?mine=1" : ""}`;

export const getExerciseUrl = (id: string) => `/api/exercises/${id}`;

export const deleteExerciseUrl = (id: string) => `/api/exercises/${id}`;

export const postIngestUrl = () => `/api/ingest`;

export const getIngestStatusUrl = (jobId: string) =>
  `/api/ingest/status?jobId=${encodeURIComponent(jobId)}`;

export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
