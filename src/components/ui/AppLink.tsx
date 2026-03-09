import Link from "next/link";

interface AppLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function AppLink({ href, children, className = "" }: AppLinkProps) {
  return (
    <Link
      href={href}
      className={`text-primary underline-offset-4 transition-colors hover:text-primary-hover hover:underline focus-visible:underline ${className}`}
    >
      {children}
    </Link>
  );
}
