"use client";

import { PromptDisplay } from "@/components/PromptDisplay";
import { MathDisplay } from "@/components/MathDisplay";
import { FractionInput } from "@/components/inputs/FractionInput";
import { MultipleChoiceInput } from "@/components/inputs/MultipleChoiceInput";
import { TrueFalseInput } from "@/components/inputs/TrueFalseInput";
import { OpenTextInput } from "@/components/inputs/OpenTextInput";
import type { Question, SessionAnswer } from "@/types/exercise";

interface QuestionRendererProps {
  question: Question;
  answer: SessionAnswer | undefined;
  onAnswerChange: (value: string | string[], workings?: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export function QuestionRenderer({
  question,
  answer,
  onAnswerChange,
  onConfirm,
  disabled = false,
}: QuestionRendererProps) {
  const value = answer?.value ?? (question.type === "multiple_choice" ? [] : "");
  const showFeedback = answer !== undefined && answer.isCorrect !== null;
  const confirmed = answer !== undefined;

  const handleChange = (v: string | string[], workings?: string) => {
    onAnswerChange(v, workings);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-lg bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {question.section}
        </span>
        <span className="rounded-lg bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {question.points} pt{question.points !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="text-lg text-foreground">
        <PromptDisplay text={question.prompt} />
      </div>
      {question.type === "open" && (
        <p className="text-sm text-muted-foreground">
          Open question — not graded
        </p>
      )}
      {question.requiresSteps && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-muted-foreground">
            Show working
          </label>
          <textarea
            value={answer?.workings ?? ""}
            onChange={(e) =>
              handleChange(
                typeof value === "string" ? value : value,
                e.target.value
              )
            }
            disabled={disabled}
            placeholder="Show your working..."
            rows={4}
            className="min-h-[80px] rounded-xl border-2 border-zinc-200 bg-card px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-zinc-600"
          />
        </div>
      )}
      <div className="flex flex-col gap-4">
        {question.type === "numeric" || question.type === "expression" ? (
          <FractionInput
            question={question}
            value={typeof value === "string" ? value : ""}
            onChange={(v) => handleChange(v)}
            onConfirm={onConfirm}
            disabled={disabled}
            showFeedback={showFeedback}
          />
        ) : question.type === "multiple_choice" ? (
          <MultipleChoiceInput
            question={question}
            value={Array.isArray(value) ? value : []}
            onChange={(v) => handleChange(v)}
            onConfirm={onConfirm}
            disabled={disabled}
            showFeedback={showFeedback}
          />
        ) : question.type === "true_false" ? (
          <TrueFalseInput
            question={question}
            value={typeof value === "string" ? value : ""}
            onChange={(v) => handleChange(v)}
            onConfirm={onConfirm}
            disabled={disabled}
            showFeedback={showFeedback}
            workings={answer?.workings ?? ""}
            onWorkingsChange={(w) =>
              handleChange(
                typeof value === "string" ? value : "",
                w
              )
            }
          />
        ) : (
          <OpenTextInput
            question={question}
            value={typeof value === "string" ? value : ""}
            onChange={(v) => handleChange(v)}
            onConfirm={onConfirm}
            disabled={disabled}
            showFeedback={showFeedback}
          />
        )}
      </div>
      {showFeedback && answer && (
        <div className="rounded-xl border border-zinc-200 bg-muted/30 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            {answer.isCorrect ? (
              <span className="text-lg text-success">✓</span>
            ) : (
              <span className="text-lg text-error">✗</span>
            )}
            <span
              className={
                answer.isCorrect ? "font-medium text-success" : "font-medium text-error"
              }
            >
              {answer.isCorrect ? "Correct" : "Incorrect"}
            </span>
          </div>
          {!answer.isCorrect && question.answerLatex && (
            <p className="mt-2 text-sm text-muted-foreground">
              Correct answer: <MathDisplay latex={question.answerLatex} />
            </p>
          )}
        </div>
      )}
    </div>
  );
}
