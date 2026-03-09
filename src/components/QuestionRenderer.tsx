import { PromptDisplay } from "@/components/PromptDisplay";
import { MultipleChoiceInput } from "@/components/inputs/MultipleChoiceInput";

export function QuestionRenderer() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-lg text-foreground">
        <PromptDisplay text="Question (stub)" />
      </div>
      <div className="flex flex-col gap-4">
        <MultipleChoiceInput />
      </div>
    </div>
  );
}
