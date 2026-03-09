"use client";

import type { Question } from "@/types/exercise";

interface TrueFalseInputProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
  showFeedback?: boolean;
  workings?: string;
  onWorkingsChange?: (value: string) => void;
}

export function TrueFalseInput({
  question,
  value,
  onChange,
  onConfirm,
  disabled = false,
  showFeedback = false,
  workings = "",
  onWorkingsChange,
}: TrueFalseInputProps) {
  const requiresExample = question.requiresExample ?? false;
  const showCounterexample = requiresExample && value === "false";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange("true")}
          disabled={disabled}
          className={`min-h-[44px] flex-1 rounded-xl border-2 font-medium transition-all duration-150 focus-visible:outline-none disabled:opacity-60 ${
            value === "true"
              ? "border-primary bg-primary/10 text-foreground dark:bg-primary/20"
              : "border-zinc-200 bg-card text-foreground hover:border-primary/50 hover:bg-primary/5 dark:border-zinc-600"
          }`}
        >
          True
        </button>
        <button
          type="button"
          onClick={() => onChange("false")}
          disabled={disabled}
          className={`min-h-[44px] flex-1 rounded-xl border-2 font-medium transition-all duration-150 focus-visible:outline-none disabled:opacity-60 ${
            value === "false"
              ? "border-primary bg-primary/10 text-foreground dark:bg-primary/20"
              : "border-zinc-200 bg-card text-foreground hover:border-primary/50 hover:bg-primary/5 dark:border-zinc-600"
          }`}
        >
          False
        </button>
      </div>
      {showCounterexample && onWorkingsChange && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-muted-foreground">
            Counterexample (optional)
          </label>
          <textarea
            value={workings}
            onChange={(e) => onWorkingsChange(e.target.value)}
            disabled={disabled}
            placeholder="Provide a counterexample..."
            rows={3}
            className="min-h-[80px] rounded-xl border-2 border-zinc-200 bg-card px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-zinc-600"
          />
        </div>
      )}
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="min-h-[44px] w-fit rounded-xl border-2 border-primary bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        Confirm
      </button>
      {showFeedback && (
        <p className="text-sm text-muted-foreground">
          Answer submitted. Check feedback above.
        </p>
      )}
    </div>
  );
}
