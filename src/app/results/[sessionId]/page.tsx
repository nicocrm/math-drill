import Link from "next/link";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted-foreground">
          Session ID: {sessionId}
        </p>
        <p>Not implemented</p>
        <Link
          href="/"
          className="text-primary hover:underline underline-offset-4"
        >
          Back to Home
        </Link>
      </main>
    </div>
  );
}
