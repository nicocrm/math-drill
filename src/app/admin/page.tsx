import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Upload</h1>
        <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center text-muted-foreground">
          Placeholder for future DropZone
        </div>
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
