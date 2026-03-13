import Link from "next/link";
import { AuthHeader } from "./AuthHeader";

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function PageLayout({ children, title, subtitle }: PageLayoutProps) {
  return (
    <div className="min-h-screen p-6 sm:p-8">
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground transition-colors duration-150 hover:text-primary focus-visible:text-primary"
        >
          MathDrill
        </Link>
        <AuthHeader />
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
