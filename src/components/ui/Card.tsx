interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-card p-6 text-card-foreground shadow-card transition-shadow duration-150 dark:border-zinc-700 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
