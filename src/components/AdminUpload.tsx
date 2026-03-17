import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropZone } from "@/components/DropZone";
import type { JobStartedData } from "@/components/DropZone";
import { IngestionStatus } from "@/components/IngestionStatus";
import { getExercisesUrl, deleteExerciseUrl, authHeaders } from "@/lib/api";
import type { ExerciseSet } from "@/types/exercise";

export function AdminUpload() {
  const { getToken } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);
  const [initialJobStatus, setInitialJobStatus] = useState<{ status: string; progress: number } | null>(null);
  const [exercises, setExercises] = useState<ExerciseSet[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(getExercisesUrl(true), {
        headers: authHeaders(token),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { exercises: ExerciseSet[] };
      setExercises(data.exercises ?? []);
    } catch {
      /* ignore */
    }
  }, [getToken]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this exercise?")) return;
    setDeleting(id);
    try {
      const token = await getToken();
      const res = await fetch(deleteExerciseUrl(id), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (res.ok) {
        setExercises((prev) => prev.filter((ex) => ex.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DropZone
        onJobStarted={(data: JobStartedData) => {
          setJobId(data.jobId);
          setInitialJobStatus({ status: data.status, progress: data.progress });
        }}
      />
      {jobId && (
        <IngestionStatus
          jobId={jobId}
          initialStatus={initialJobStatus ?? undefined}
          onComplete={fetchExercises}
        />
      )}

      {exercises.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            My Exercises
          </h2>
          {exercises.map((ex) => (
            <Card
              key={ex.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {ex.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ex.subject} &middot; {ex.questions?.length ?? 0} questions
                </p>
              </div>
              <button
                onClick={() => handleDelete(ex.id)}
                disabled={deleting === ex.id}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {deleting === ex.id ? "Deleting..." : "Delete"}
              </button>
            </Card>
          ))}
        </div>
      )}

      <Button href="/" variant="outline" size="md">
        Back to Home
      </Button>
    </div>
  );
}
