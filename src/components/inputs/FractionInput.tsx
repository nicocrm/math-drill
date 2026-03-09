export function FractionInput() {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">
        Fraction (stub)
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Num"
          className="h-12 w-16 rounded-xl border-2 border-zinc-200 bg-card px-3 text-center text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600"
        />
        <span className="text-xl font-medium text-muted-foreground">/</span>
        <input
          type="text"
          placeholder="Den"
          className="h-12 w-16 rounded-xl border-2 border-zinc-200 bg-card px-3 text-center text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600"
        />
      </div>
    </div>
  );
}
