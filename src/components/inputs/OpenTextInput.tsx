
import type { Question } from "@/types/exercise";

interface OpenTextInputProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function OpenTextInput({
  value,
  onChange,
  onConfirm,
  disabled = false,
}: OpenTextInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Open question — not graded
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Type your answer..."
        rows={4}
        className="min-h-[100px] rounded-xl border-2 border-zinc-200 bg-card px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-zinc-600"
      />
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
