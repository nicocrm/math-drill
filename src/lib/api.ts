const API_BASE = import.meta.env.VITE_API_URL || "";

export function getExercisesUrl(mine?: boolean): string {
  return `${API_BASE}/api/exercises${mine ? "?mine=1" : ""}`;
}

export function getExerciseUrl(id: string): string {
  return `${API_BASE}/api/exercises/${id}`;
}

export function deleteExerciseUrl(id: string): string {
  return `${API_BASE}/api/exercises/${id}`;
}

export function postIngestUrl(): string {
  return `${API_BASE}/api/ingest`;
}

export function getIngestStatusUrl(jobId: string): string {
  return `${API_BASE}/api/ingest/status?jobId=${encodeURIComponent(jobId)}`;
}

export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
