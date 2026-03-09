export function OpenTextInput() {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">
        Open text (stub)
      </label>
      <input
        type="text"
        placeholder="Type your answer..."
        className="min-h-[44px] rounded-xl border-2 border-zinc-200 bg-card px-4 py-2 text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600"
      />
    </div>
  );
}
