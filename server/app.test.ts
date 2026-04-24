import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { createServer, type Server } from "http";
import type { AddressInfo } from "node:net";
import type { Queue } from "bullmq";
import { createApp } from "./app.js";
import type { IngestPayload } from "@math-drill/core/ingest/handleIngest";

function mockIngestQueue(): Queue<IngestPayload> {
  return { add: () => Promise.resolve() } as unknown as Queue<IngestPayload>;
}

describe("createApp (serveStatic: true)", () => {
  let root: string;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "app-test-"));
    await mkdir(path.join(root, "assets"), { recursive: true });
    await writeFile(
      path.join(root, "index.html"),
      "<!doctype html><html><body>spa</body></html>",
      "utf-8"
    );
    await writeFile(
      path.join(root, "assets", "foo.js"),
      "console.log(1);",
      "utf-8"
    );
    const app = createApp({
      serveStatic: true,
      distFrontend: root,
      ingestQueue: mockIngestQueue(),
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await rm(root, { recursive: true, force: true });
  });

  it("GET /api/exercises returns JSON 200", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/exercises`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { exercises: unknown[] };
    expect(Array.isArray(body.exercises)).toBe(true);
  });

  it("GET /api/definitely-not-a-route returns JSON 404, not index.html", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/definitely-not-a-route`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Not found");
  });

  it("GET /some/spa/route returns index.html 200", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/some/spa/route`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("spa");
  });

  it("GET /assets/foo.js sets long immutable cache", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/assets/foo.js`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toMatch(/max-age=31536000/);
    expect(cc).toMatch(/immutable/);
  });

  it("GET /index.html sets short cache", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/index.html`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toMatch(/max-age=300/);
  });
});
