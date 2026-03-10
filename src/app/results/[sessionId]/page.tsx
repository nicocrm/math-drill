"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScoreBoard } from "@/components/ScoreBoard";
import { PromptDisplay } from "@/components/PromptDisplay";
import { MathDisplay } from "@/components/MathDisplay";
import { getSession } from "@/lib/sessionStore";
import type { Session, ExerciseSet, Question } from "@/types/exercise";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [exercise, setExercise] = useState<ExerciseSet | null>(null);

  useEffect(() => {
    const s = getSession(sessionId);
    queueMicrotask(() => setSession(s ?? null));
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    const exerciseSetId = session.exerciseSetId;
    let cancelled = false;
    async function fetchExercise() {
      try {
        const res = await fetch(`/api/exercises/${exerciseSetId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ExerciseSet;
        if (!cancelled) setExercise(data);
      } catch {
        if (!cancelled) setExercise(null);
      }
    }
    fetchExercise();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleTryAgain = () => {
    if (session) {
      router.push(`/session/${session.exerciseSetId}`);
    }
  };

  const handleBackToHome = () => {
    router.push("/");
  };

  if (!session) {
    return (
      <PageLayout title="Results" subtitle="Session not found">
        <Card>
          <p className="text-muted-foreground">Session not found.</p>
          <Button href="/" variant="outline" size="md" className="mt-4">
            Back to Home
          </Button>
        </Card>
      </PageLayout>
    );
  }

  const totalPoints = exercise?.questions?.reduce((s, q) => s + q.points, 0) ?? 0;
  const score = session.answers.reduce((s, a) => s + a.pointsAwarded, 0);
  const correctCount = session.answers.filter((a) => a.isCorrect === true).length;
  const totalQuestions = session.answers.length;

  type SectionBreakdown = { label: string; earned: number; maxPoints: number };
  const sectionBreakdowns: SectionBreakdown[] =
    exercise?.sections?.map((sec) => {
      const questionsInSection = exercise.questions.filter(
        (q) => q.section === sec.label
      );
      const maxPoints = sec.maxPoints;
      const earned = session.answers
        .filter((a) => questionsInSection.some((q) => q.id === a.questionId))
        .reduce((s, a) => s + a.pointsAwarded, 0);
      return { label: sec.label, earned, maxPoints };
    }) ?? [];

  const getQuestion = (questionId: string): Question | undefined =>
    exercise?.questions?.find((q) => q.id === questionId);

  return (
    <PageLayout title="Results" subtitle="Your score and review">
      <div className="flex flex-col gap-6">
        <ScoreBoard
          score={score}
          total={totalPoints}
          correct={correctCount}
          totalQuestions={totalQuestions}
        />
        {sectionBreakdowns.length > 0 && (
          <Card className="flex flex-col gap-2">
            <h2 className="font-semibold text-foreground">By section</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {sectionBreakdowns.map((sb) => (
                <span key={sb.label}>
                  {sb.label}: {sb.earned}/{sb.maxPoints} pts
                </span>
              ))}
            </div>
          </Card>
        )}
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold text-foreground">Per-question review</h2>
          {session.answers.map((answer) => {
            const q = getQuestion(answer.questionId);
            return (
              <div
                key={answer.questionId}
                className="rounded-xl border border-zinc-200 bg-muted/30 p-4 dark:border-zinc-700"
              >
                {q && (
                  <>
                    <div className="mb-2">
                      <PromptDisplay text={q.prompt} />
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {answer.isCorrect === true && (
                        <span className="rounded bg-success/20 px-2 py-0.5 font-medium text-success">
                          ✓ Correct
                        </span>
                      )}
                      {answer.isCorrect === false && (
                        <span className="rounded bg-error/20 px-2 py-0.5 font-medium text-error">
                          ✗ Incorrect
                        </span>
                      )}
                      {answer.isCorrect === null && q.type === "open" && (
                        <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                          Not graded
                        </span>
                      )}
                    </div>
                    {answer.isCorrect === false && q.answerLatex && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Correct: <MathDisplay latex={q.answerLatex} />
                      </p>
                    )}
                    {q.explanation && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Concept: </span>
                        <PromptDisplay text={q.explanation} />
                      </div>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your answer:{" "}
                      {Array.isArray(answer.value)
                        ? answer.value.join(", ")
                        : answer.value || "(none)"}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleTryAgain} variant="primary" size="md">
            Try again
          </Button>
          <Button onClick={handleBackToHome} variant="outline" size="md">
            Back to Home
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
