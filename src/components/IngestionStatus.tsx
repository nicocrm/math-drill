import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { getIngestStatusUrl } from "@/lib/api";

interface IngestionStatusProps {
  jobId: string;
  initialStatus?: { status: string; progress: number };
  onComplete?: () => void;
  onError?: () => void;
}

interface StatusData {
  status: string;
  progress?: number;
  exerciseId?: string;
  questionCount?: number;
  error?: string;
}

export function IngestionStatus({ jobId, initialStatus, onComplete, onError }: IngestionStatusProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusData | null>(initialStatus ?? null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    setStatus(initialStatus ?? null);
    setPollError(null);

    const poll = async () => {
      try {
        const res = await fetch(getIngestStatusUrl(jobId));
        if (!res.ok) {
          let msg = `Status check failed (${res.status})`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) msg = body.error;
          } catch {
            /* use default */
          }
          setPollError(msg);
          onError?.();
          return true;
        }
        const data = (await res.json()) as StatusData;
        setStatus(data);
        if (data.status === "done" && data.exerciseId) {
          onComplete?.();
          navigate(`/session?id=${data.exerciseId}`);
          return true;
        }
        if (data.status === "error") {
          onError?.();
          return true;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to check status";
        setPollError(msg);
        onError?.();
        return true;
      }
      return false;
    };

    const interval = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(interval);
    }, 15000);

    poll();

    return () => clearInterval(interval);
  }, [jobId, initialStatus, navigate, onComplete, onError]);

  if (pollError) {
    return (
      <div className="rounded-xl border border-error/50 bg-error/10 px-4 py-3 text-sm text-error dark:border-error/30">
        <p className="font-medium">Error</p>
        <p>{pollError}</p>
      </div>
    );
  }

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

  const pct = Math.round(status.progress ?? 0);

  return (
    <div className="rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-base text-foreground dark:border-primary/30">
      <p className="flex items-center gap-2 font-medium capitalize">
        <svg className="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        {status.status}
      </p>
      {status.progress !== undefined && (
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{pct}%</span>
        </div>
      )}
    </div>
  );
}
