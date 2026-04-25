
import { MathDisplay } from "@/components/MathDisplay";
import type { Question } from "@/types/exercise";

interface MultipleChoiceInputProps {
  question: Question;
  value: string[];
  onChange: (value: string[]) => void;
  onConfirm: () => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function MultipleChoiceInput({
  question,
  value,
  onChange,
  onConfirm,
  disabled = false,
}: MultipleChoiceInputProps) {
  const choices = question.choices ?? [];
  const _correctIds = Array.isArray(question.answerMath)
    ? (question.answerMath as string[])
    : [];

  const toggle = (id: string) => {
    if (disabled) return;
    const next = value.includes(id)
      ? value.filter((c) => c !== id)
      : [...value, id];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {choices.map((choice) => {
          const selected = value.includes(choice.id);
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => toggle(choice.id)}
              disabled={disabled}
              className={`min-h-[44px] rounded-xl border-2 px-4 py-2 text-left font-medium transition-all duration-150 focus-visible:outline-hidden disabled:opacity-60 ${
                selected
                  ? "border-primary bg-primary/10 text-foreground dark:bg-primary/20"
                  : "border-zinc-200 bg-card text-foreground hover:border-primary/50 hover:bg-primary/5 dark:border-zinc-600"
              }`}
            >
              <MathDisplay latex={choice.latex} />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="min-h-[44px] w-fit rounded-xl border-2 border-primary bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        Confirm
      </button>
    </div>
  );
}
