import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/ingestJobs";

function formatSSEData(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { error: "Missing jobId query parameter" },
      { status: 400 }
    );
  }

  const accept = request.headers.get("accept") ?? "";

  if (accept.includes("text/event-stream")) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let lastProgress = -1;
        let lastStatus: string | null = null;

        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(formatSSEData(data)));
        };

        const poll = async () => {
          const job = await getJob(jobId);
          if (!job) {
            send({ step: "saving", progress: 0, error: "Job not found" });
            controller.close();
            return;
          }

          const step = job.step ?? "saving";
          const progress = job.progress ?? 0;

          if (progress !== lastProgress || job.status !== lastStatus) {
            lastProgress = progress;
            lastStatus = job.status;
            const event: Record<string, unknown> = {
              step,
              progress,
            };
            if (job.exerciseId) event.exerciseId = job.exerciseId;
            if (job.error) event.error = job.error;
            send(event);
          }

          if (job.status === "done" || job.status === "error") {
            send({
              step: "done",
              progress: 100,
              ...(job.exerciseId && { exerciseId: job.exerciseId }),
              ...(job.questionCount !== undefined && {
                questionCount: job.questionCount,
              }),
              ...(job.error && { error: job.error }),
            });
            controller.close();
            return;
          }

          setTimeout(poll, 500);
        };

        poll();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { status: "pending", progress: 0, error: "Job not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: job.status,
    ...(job.progress !== undefined && { progress: job.progress }),
    ...(job.exerciseId && { exerciseId: job.exerciseId }),
    ...(job.questionCount !== undefined && {
      questionCount: job.questionCount,
    }),
    ...(job.error && { error: job.error }),
  });
}
