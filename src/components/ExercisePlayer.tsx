import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { v4 as uuidv4 } from "uuid";
import { ScoreBoard } from "@/components/ScoreBoard";
import { QuestionRenderer } from "@/components/QuestionRenderer";
import { Button } from "@/components/ui/Button";
import { apiUrl } from "@/lib/api";
import {
  checkFraction,
  checkExpression,
  checkMultipleChoice,
  checkTrueFalse,
} from "@/lib/mathValidation";
import { saveSession } from "@/lib/sessionStore";
import type {
  ExerciseSet,
  Question,
  Session,
} from "@/types/exercise";

interface ExercisePlayerProps {
  exerciseId: string;
}

export function ExercisePlayer({ exerciseId }: ExercisePlayerProps) {
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<ExerciseSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchExercise() {
      try {
        const res = await fetch(apiUrl(`/api/exercises/${exerciseId}`));
        if (!res.ok) {
          if (res.status === 404) {
            setError("Exercise not found");
          } else {
            setError("Failed to load exercise");
          }
          setExercise(null);
          return;
        }
        const data = (await res.json()) as ExerciseSet;
        if (!cancelled) {
          setExercise(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load exercise");
          setExercise(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchExercise();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  useEffect(() => {
    if (!exercise) return;
    const newSession: Session = {
      id: uuidv4(),
      exerciseSetId: exercise.id,
      startedAt: new Date().toISOString(),
      answers: exercise.questions.map((q) => ({
        questionId: q.id,
        value: q.type === "multiple_choice" ? [] : "",
        isCorrect: null,
        pointsAwarded: 0,
      })),
    };
    setSession(newSession);
    setCurrentIndex(0);
  }, [exercise]);

  const currentQuestion = exercise?.questions[currentIndex];
  const currentAnswer = session?.answers.find(
    (a) => a.questionId === currentQuestion?.id
  );
  const hasConfirmed = currentAnswer?.isCorrect !== null;
  const isLastQuestion =
    exercise && currentIndex === exercise.questions.length - 1;

  const validateAnswer = useCallback(
    (question: Question, value: string | string[]): boolean => {
      const correct = question.answerMath;
      if (question.type === "open" || correct === null) return true;
      if (question.type === "numeric" || question.type === "expression") {
        const str = typeof value === "string" ? value : "";
        const correctStr = typeof correct === "string" ? correct : "";
        return (
          checkExpression(str, correctStr) || checkFraction(str, correctStr)
        );
      }
      if (question.type === "multiple_choice") {
        return checkMultipleChoice(
          Array.isArray(value) ? value : [],
          Array.isArray(correct) ? correct : []
        );
      }
      if (question.type === "true_false") {
        return checkTrueFalse(
          typeof value === "string" ? value : "",
          typeof correct === "string" ? correct : ""
        );
      }
      return false;
    },
    []
  );

  const handleAnswerChange = useCallback(
    (value: string | string[], workings?: string) => {
      if (!session || !currentQuestion) return;
      setSession((prev) => {
        if (!prev) return prev;
        const idx = prev.answers.findIndex(
          (a) => a.questionId === currentQuestion.id
        );
        if (idx < 0) return prev;
        const next = [...prev.answers];
        next[idx] = {
          ...next[idx],
          value,
          ...(workings !== undefined && { workings }),
        };
        return { ...prev, answers: next };
      });
    },
    [session, currentQuestion]
  );

  const handleConfirm = useCallback(() => {
    if (!session || !currentQuestion) return;
    const answer = session.answers.find(
      (a) => a.questionId === currentQuestion.id
    );
    if (!answer || answer.isCorrect !== null) return;
    const value = answer.value;
    const isCorrect = validateAnswer(currentQuestion, value);
    const pointsAwarded = isCorrect ? currentQuestion.points : 0;
    setSession((prev) => {
      if (!prev) return prev;
      const idx = prev.answers.findIndex(
        (a) => a.questionId === currentQuestion.id
      );
      if (idx < 0) return prev;
      const next = [...prev.answers];
      next[idx] = {
        ...next[idx],
        isCorrect,
        pointsAwarded,
      };
      return { ...prev, answers: next };
    });
  }, [session, currentQuestion, validateAnswer]);

  const handleNext = useCallback(() => {
    if (!session || !exercise) return;
    if (!hasConfirmed) return;
    saveSession(session);
    if (isLastQuestion) {
      const completed: Session = {
        ...session,
        completedAt: new Date().toISOString(),
      };
      saveSession(completed);
      navigate(`/results?id=${completed.id}`);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [session, exercise, hasConfirmed, isLastQuestion, navigate]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-card p-6 dark:border-zinc-700">
        <p className="text-muted-foreground">Loading exercise...</p>
      </div>
    );
  }

  if (error || !exercise || !session) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-card p-6 dark:border-zinc-700">
          <p className="text-muted-foreground">{error ?? "Exercise not found"}</p>
        </div>
        <Button href="/" variant="outline" size="md">
          Back to Home
        </Button>
      </div>
    );
  }

  const totalPoints = exercise.questions.reduce((s, q) => s + q.points, 0);
  const scoreSoFar = session.answers.reduce((s, a) => s + a.pointsAwarded, 0);
  const correctCount = session.answers.filter((a) => a.isCorrect === true).length;

  return (
    <div className="flex flex-col gap-6">
      <ScoreBoard
        score={scoreSoFar}
        total={totalPoints}
        correct={correctCount}
        totalQuestions={exercise.questions.length}
      />
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / exercise.questions.length) * 100}%`,
          }}
        />
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-card p-6 shadow-card dark:border-zinc-700">
        {currentQuestion && (
          <>
            <QuestionRenderer
              question={currentQuestion}
              answer={currentAnswer}
              onAnswerChange={handleAnswerChange}
              onConfirm={handleConfirm}
              disabled={hasConfirmed}
            />
            {hasConfirmed && (
              <div className="mt-6 flex justify-end">
                <Button onClick={handleNext} variant="primary" size="lg">
                  {isLastQuestion ? "Finish" : "Next"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
