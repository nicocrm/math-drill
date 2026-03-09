import { ScoreBoard } from "@/components/ScoreBoard";
import { QuestionRenderer } from "@/components/QuestionRenderer";

export function ExercisePlayer() {
  return (
    <div className="flex flex-col gap-6">
      <ScoreBoard />
      <div className="rounded-2xl border border-zinc-200 bg-card p-6 shadow-card dark:border-zinc-700">
        <QuestionRenderer />
      </div>
    </div>
  );
}
