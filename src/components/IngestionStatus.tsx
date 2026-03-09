"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface IngestionStatusProps {
  jobId: string;
}

interface StatusData {
  status: string;
  progress?: number;
  exerciseId?: string;
  error?: string;
}

export function IngestionStatus({ jobId }: IngestionStatusProps) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/ingest/status?jobId=${encodeURIComponent(jobId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as StatusData;
        setStatus(data);
        if (data.status === "done" && data.exerciseId) {
          router.push(`/session/${data.exerciseId}`);
          return true;
        }
        if (data.status === "error") {
          return true;
        }
      } catch {
        // Ignore
      }
      return false;
    };

    const interval = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(interval);
    }, 1000);

    poll();

    return () => clearInterval(interval);
  }, [jobId, router]);

  if (!status) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-muted/50 px-4 py-3 text-sm text-muted-foreground dark:border-zinc-700">
        Connecting...
      </div>
    );
  }

  if (status.status === "error") {
    return (
      <div className="rounded-xl border border-error/50 bg-error/10 px-4 py-3 text-sm text-error dark:border-error/30">
        <p className="font-medium">Error</p>
        <p>{status.error ?? "Something went wrong"}</p>
      </div>
    );
  }

  if (status.status === "done" && status.exerciseId) {
    return (
      <div className="rounded-xl border border-success/50 bg-success/10 px-4 py-3 text-sm text-success dark:border-success/30">
        <p className="font-medium">Done!</p>
        <Link
          href={`/session/${status.exerciseId}`}
          className="underline hover:no-underline"
        >
          Start exercise →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-muted/50 px-4 py-3 text-sm text-muted-foreground dark:border-zinc-700">
      <p className="font-medium capitalize">{status.status}</p>
      {status.progress !== undefined && (
        <p>Progress: {Math.round(status.progress * 100)}%</p>
      )}
    </div>
  );
}
