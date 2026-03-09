export function MultipleChoiceInput() {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-muted-foreground">
        Multiple choice (stub)
      </label>
      <div className="flex flex-wrap gap-3">
        {["A", "B", "C"].map((choice) => (
          <button
            key={choice}
            type="button"
            className="min-h-[44px] rounded-xl border-2 border-zinc-200 bg-card px-4 py-2 text-left font-medium text-foreground transition-all duration-150 hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none dark:border-zinc-600"
          >
            Option {choice}
          </button>
        ))}
      </div>
    </div>
  );
}
