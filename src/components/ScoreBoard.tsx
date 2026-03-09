interface ScoreBoardProps {
  score?: number;
  total?: number;
  correct?: number;
  totalQuestions?: number;
}

export function ScoreBoard({
  score = 0,
  total = 0,
  correct = 0,
  totalQuestions = 0,
}: ScoreBoardProps) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-card p-4 shadow-card dark:border-zinc-700">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Score</p>
          <p className="text-2xl font-bold text-foreground">
            {score} / {total}
          </p>
        </div>
        {totalQuestions > 0 && (
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">
              Correct
            </p>
            <p className="text-2xl font-bold text-success">
              {correct} / {totalQuestions}
            </p>
          </div>
        )}
        {total > 0 && (
          <div className="rounded-xl bg-primary/10 px-4 py-2">
            <p className="text-sm font-medium text-primary">{percentage}%</p>
          </div>
        )}
      </div>
    </div>
  );
}
