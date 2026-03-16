import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { getIngestStatusUrl } from "@/lib/api";

interface IngestionStatusProps {
  jobId: string;
  onComplete?: () => void;
}

interface StatusData {
  status: string;
  progress?: number;
  exerciseId?: string;
  questionCount?: number;
  error?: string;
}

export function IngestionStatus({ jobId, onComplete }: IngestionStatusProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    if (!jobId) return;

    setStatus(null);

    const poll = async () => {
      try {
        const res = await fetch(
          getIngestStatusUrl(jobId)
        );
        if (!res.ok) return;
        const data = (await res.json()) as StatusData;
        setStatus(data);
        if (data.status === "done" && data.exerciseId) {
          onComplete?.();
          navigate(`/session?id=${data.exerciseId}`);
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
    }, 15000);

    poll();

    return () => clearInterval(interval);
  }, [jobId, navigate, onComplete]);

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
        {status.questionCount !== undefined && (
          <p className="text-muted-foreground">
            {status.questionCount} exercises extracted.
          </p>
        )}
        <Link
          to={`/session?id=${status.exerciseId}`}
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
        <p>Progress: {Math.round(status.progress)}%</p>
      )}
    </div>
  );
}
