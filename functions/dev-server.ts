import express from "express";
import type { Request, Response } from "express";
import type { ScalewayEvent } from "./lib/scaleway";
import { handle as getExercises } from "./get-exercises/handler";
import { handle as getExercise } from "./get-exercise/handler";
import { handle as deleteExercise } from "./delete-exercise/handler";
import { handle as postIngest } from "./post-ingest/handler";
import { handle as getIngestStatus } from "./get-ingest-status/handler";

function toScalewayEvent(req: Request): ScalewayEvent {
  let body = "";
  if (req.body) {
    if (Buffer.isBuffer(req.body)) {
      body = req.body.toString("base64");
    } else if (typeof req.body === "string") {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
    }
  }

  return {
    httpMethod: req.method,
    path: req.path,
    queryStringParameters: req.query as Record<string, string>,
    headers: req.headers as Record<string, string>,
    body,
    isBase64Encoded: Buffer.isBuffer(req.body),
  };
}

function wrapHandler(handler: (event: ScalewayEvent) => Promise<{ statusCode: number; headers?: Record<string, string>; body: string }>) {
  return async (req: Request, res: Response) => {
    try {
      const event = toScalewayEvent(req);
      const result = await handler(event);
      if (result.headers) {
        Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
      }
      res.status(result.statusCode).send(result.body);
    } catch (err) {
      console.error("Handler error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  };
}

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.raw({ type: "application/pdf", limit: "50mb" }));

app.get("/api/exercises", wrapHandler(getExercises));
app.get("/api/exercises/:id", wrapHandler(getExercise));
app.delete("/api/exercises/:id", wrapHandler(deleteExercise));
app.post("/api/ingest", wrapHandler(postIngest));
app.get("/api/ingest/status", wrapHandler(getIngestStatus));

const PORT = process.env.API_PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Dev API server running on http://localhost:${PORT}`);
});
