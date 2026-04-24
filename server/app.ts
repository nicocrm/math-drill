import path from "path";
import type { Request, Response, NextFunction } from "express";
import express, { type Express } from "express";
import type { Queue } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { verifyAuth, requireAuth, HttpError } from "@math-drill/core/auth";
import {
  getExerciseStorage,
  getFileStorage,
  getJobStatusStore,
} from "@math-drill/core/env";
import type { IngestPayload } from "@math-drill/core/ingest/handleIngest";

const DIST_FRONTEND = path.join(process.cwd(), "dist/frontend");

export interface CreateAppOptions {
  /** When true, serve built SPA and asset caching from `dist/frontend` (or `distFrontend`). */
  serveStatic: boolean;
  /** Override path to built frontend (defaults to `dist/frontend` under cwd). */
  distFrontend?: string;
  /** BullMQ queue for ingest; required. */
  ingestQueue: Queue<IngestPayload>;
}

function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  }
}

function registerApiRoutes(
  app: express.Application,
  ingestQueue: Queue<IngestPayload>
) {
  app.get(
    "/api/exercises",
    asyncHandler(async (req, res) => {
      const t0 = Date.now();
      const storage = getExerciseStorage();
      const mine = req.query.mine;

      if (mine) {
        const authHeader = req.get("Authorization");
        const t1 = Date.now();
        const auth = await verifyAuth(
          new Request("http://localhost", {
            headers: authHeader ? { Authorization: authHeader } : {},
          })
        );
        const t2 = Date.now();
        if (!auth.userId) {
          console.log(`[get-exercises] mine=1 auth=fail ${t2 - t0}ms total`);
          res.status(401).json({ error: "Authentication required" });
          return;
        }
        const exercises = await storage.listByUser(auth.userId);
        const t3 = Date.now();
        console.log(
          `[get-exercises] mine=1 init=${t1 - t0}ms auth=${t2 - t1}ms storage=${t3 - t2}ms total=${t3 - t0}ms count=${exercises.length}`
        );
        res.json({ exercises });
        return;
      }

      const t1 = Date.now();
      const exercises = await storage.list();
      const t2 = Date.now();
      console.log(
        `[get-exercises] mine=0 init=${t1 - t0}ms storage=${t2 - t1}ms total=${t2 - t0}ms count=${exercises.length}`
      );
      res.json({ exercises });
    })
  );

  app.get(
    "/api/exercises/:id",
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: "Missing exercise id" });
        return;
      }
      const storage = getExerciseStorage();
      const exercise = await storage.get(id);
      if (!exercise) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(exercise);
    })
  );

  app.delete(
    "/api/exercises/:id",
    asyncHandler(async (req, res) => {
      const authHeader = req.get("Authorization");
      try {
        const auth = await verifyAuth(
          new Request("http://localhost", {
            headers: authHeader ? { Authorization: authHeader } : {},
          })
        );
        requireAuth(auth);
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ error: "Missing exercise id" });
          return;
        }
        const storage = getExerciseStorage();
        const exercise = await storage.get(id);
        if (!exercise) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        if (exercise.createdBy && exercise.createdBy !== auth.userId) {
          res.status(403).json({ error: "Not authorized to delete this exercise" });
          return;
        }
        await storage.delete(id);
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof HttpError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        throw err;
      }
    })
  );

  app.post(
    "/api/ingest",
    asyncHandler(async (req, res) => {
      const authHeader = req.get("Authorization");
      try {
        const auth = await verifyAuth(
          new Request("http://localhost", {
            headers: authHeader ? { Authorization: authHeader } : {},
          })
        );
        requireAuth(auth);
        if (!req.body) {
          res.status(400).json({ error: "Missing request body" });
          return;
        }
        const body = req.body as { pdf?: string; filename?: string };
        if (!body.pdf) {
          res.status(400).json({ error: "Missing pdf field" });
          return;
        }
        const pdfBuffer = Buffer.from(body.pdf, "base64");
        const filename: string = body.filename ?? "document.pdf";

        const jobId = uuidv4();
        const exerciseId = uuidv4();
        const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const s3Key = `${jobId}-${safeName}`;

        const jobStore = getJobStatusStore();
        await jobStore.set(jobId, { status: "pending", progress: 0 });
        const fileStorage = getFileStorage();
        await jobStore.updateProgress(jobId, "saving");
        await fileStorage.upload(s3Key, pdfBuffer);

        const payload: IngestPayload = {
          jobId,
          exerciseId,
          s3Key,
          filename,
          userId: auth.userId,
        };
        await ingestQueue.add("ingest", payload, {
          attempts: 2,
          backoff: { type: "exponential", delay: 5000 },
        });

        res.json({ jobId, status: "pending", progress: 0 });
      } catch (err) {
        if (err instanceof HttpError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        const error = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error });
      }
    })
  );

  app.get(
    "/api/ingest/status",
    asyncHandler(async (req, res) => {
      const jobId = req.query.jobId;
      if (!jobId || typeof jobId !== "string") {
        res.status(400).json({ error: "Missing jobId query parameter" });
        return;
      }
      const jobStore = getJobStatusStore();
      let job;
      try {
        job = await jobStore.get(jobId);
      } catch {
        res.status(503).json({ error: "Job status service unavailable" });
        return;
      }
      if (!job) {
        res.status(404).json({
          status: "pending",
          progress: 0,
          error: "Job not found",
        });
        return;
      }
      res.json({
        status: job.status,
        ...(job.progress !== undefined && { progress: job.progress }),
        ...(job.step && { step: job.step }),
        ...(job.exerciseId && { exerciseId: job.exerciseId }),
        ...(job.questionCount !== undefined && { questionCount: job.questionCount }),
        ...(job.error && { error: job.error }),
      });
    })
  );
}

export function createApp(options: CreateAppOptions): Express {
  const { serveStatic, ingestQueue } = options;
  const root = options.distFrontend ?? DIST_FRONTEND;

  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.raw({ type: "application/pdf", limit: "50mb" }));

  registerApiRoutes(app, ingestQueue);

  if (serveStatic) {
    app.use(
      "/assets",
      express.static(path.join(root, "assets"), {
        maxAge: "1y",
        immutable: true,
      })
    );
    app.use(
      express.static(root, { maxAge: "5m", index: false })
    );
    app.use("/api", (_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
    app.use((req, res) => {
      if (req.method === "GET" || req.method === "HEAD") {
        res.sendFile(path.join(root, "index.html"));
        return;
      }
      res.status(404).end();
    });
  }

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[api] unhandled error:", err);
      res.status(500).json({ error: message });
    }
  );

  return app;
}
