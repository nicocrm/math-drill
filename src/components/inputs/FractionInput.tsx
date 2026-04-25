
import type { Question } from "@/types/exercise";

interface FractionInputProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
  showFeedback?: boolean;
}

export function FractionInput({
  question: _question,
  value,
  onChange,
  onConfirm,
  disabled = false,
  showFeedback = false,
}: FractionInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="e.g. 3/5, -2/3"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm()}
          disabled={disabled}
          className="min-h-[44px] flex-1 rounded-xl border-2 border-zinc-200 bg-card px-4 py-2 text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-zinc-600"
        />
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className="min-h-[44px] rounded-xl border-2 border-primary bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          Confirm
        </button>
      </div>
      {showFeedback && (
        <p className="text-sm text-muted-foreground">
          Answer submitted. Check feedback above.
        </p>
      )}
    </div>
  );
}
