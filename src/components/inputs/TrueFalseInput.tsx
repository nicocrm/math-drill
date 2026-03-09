export function TrueFalseInput() {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">
        True / False (stub)
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          className="min-h-[44px] flex-1 rounded-xl border-2 border-zinc-200 bg-card font-medium text-foreground transition-all duration-150 hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none dark:border-zinc-600"
        >
          True
        </button>
        <button
          type="button"
          className="min-h-[44px] flex-1 rounded-xl border-2 border-zinc-200 bg-card font-medium text-foreground transition-all duration-150 hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none dark:border-zinc-600"
        >
          False
        </button>
      </div>
    </div>
  );
}
