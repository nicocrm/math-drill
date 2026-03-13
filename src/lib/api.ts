// Unified base (used when no endpoint-specific URL is set)
const API_BASE = import.meta.env.VITE_API_URL || "";

// Endpoint-specific URLs (production — Scaleway function URLs)
const GET_EXERCISES_URL = import.meta.env.VITE_GET_EXERCISES_URL;
const GET_EXERCISE_URL = import.meta.env.VITE_GET_EXERCISE_URL;
const DELETE_EXERCISE_URL = import.meta.env.VITE_DELETE_EXERCISE_URL;
const POST_INGEST_URL = import.meta.env.VITE_POST_INGEST_URL;
const GET_INGEST_STATUS_URL = import.meta.env.VITE_GET_INGEST_STATUS_URL;

export function getExercisesUrl(mine?: boolean): string {
  if (GET_EXERCISES_URL) return mine ? `${GET_EXERCISES_URL}?mine=1` : GET_EXERCISES_URL;
  return `${API_BASE}/api/exercises${mine ? "?mine=1" : ""}`;
}

export function getExerciseUrl(id: string): string {
  if (GET_EXERCISE_URL) return `${GET_EXERCISE_URL}/${id}`;
  return `${API_BASE}/api/exercises/${id}`;
}

export function deleteExerciseUrl(id: string): string {
  if (DELETE_EXERCISE_URL) return `${DELETE_EXERCISE_URL}/${id}`;
  return `${API_BASE}/api/exercises/${id}`;
}

export function postIngestUrl(): string {
  if (POST_INGEST_URL) return POST_INGEST_URL;
  return `${API_BASE}/api/ingest`;
}

export function getIngestStatusUrl(jobId: string): string {
  if (GET_INGEST_STATUS_URL) return `${GET_INGEST_STATUS_URL}?jobId=${encodeURIComponent(jobId)}`;
  return `${API_BASE}/api/ingest/status?jobId=${encodeURIComponent(jobId)}`;
}

export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
