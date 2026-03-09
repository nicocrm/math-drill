"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ExerciseSet } from "@/types/exercise";

export default function Home() {
  const [exercises, setExercises] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExercises() {
      try {
        const res = await fetch("/api/exercises");
        if (!res.ok) return;
        const data = (await res.json()) as { exercises: ExerciseSet[] };
        setExercises(data.exercises ?? []);
      } catch {
        setExercises([]);
      } finally {
        setLoading(false);
      }
    }
    fetchExercises();
  }, []);

  const totalQuestions = (ex: ExerciseSet) =>
    ex.questions?.length ?? 0;
  const totalPoints = (ex: ExerciseSet) =>
    ex.questions?.reduce((s, q) => s + (q.points ?? 0), 0) ?? 0;

  return (
    <PageLayout title="MathDrill" subtitle="Practice math exercises">
      {loading ? (
        <Card>
          <p className="text-muted-foreground">Loading...</p>
        </Card>
      ) : exercises.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">No exercise sets yet.</p>
          <Button href="/admin" variant="primary" size="lg" className="mt-4">
            Go to Upload
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {exercises.map((ex) => (
            <Card key={ex.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">{ex.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {ex.subject} · {totalQuestions(ex)} questions · {totalPoints(ex)} pts
                </p>
                {ex.createdAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(ex.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button
                href={`/session/${ex.id}`}
                variant="primary"
                size="md"
                className="shrink-0"
              >
                Start
              </Button>
            </Card>
          ))}
          <Button href="/admin" variant="outline" size="md">
            Upload more
          </Button>
        </div>
      )}
    </PageLayout>
  );
}
