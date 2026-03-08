import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">MathDrill</h1>
        <p className="text-muted-foreground">No exercise sets yet.</p>
        <Link
          href="/admin"
          className="text-primary hover:underline underline-offset-4"
        >
          Go to Upload
        </Link>
      </main>
    </div>
  );
}
