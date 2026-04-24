import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Playwright e2e writes `.e2e-storage-dir` (JSON) in the project root so the API
 * and worker use temp exercise/intake dirs even when `npx`/`concurrently` drop env vars
 * or `process.cwd()` is not the repo root.
 */
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = path.join(projectRoot, ".e2e-storage-dir");
if (existsSync(marker)) {
  try {
    const j = JSON.parse(readFileSync(marker, "utf-8")) as {
      exercisesDir: string;
      intakeDir: string;
    };
    process.env.EXERCISES_DIR = j.exercisesDir;
    process.env.INTAKE_DIR = j.intakeDir;
    process.env.STORAGE = "local";
  } catch {
    // ignore invalid marker
  }
}
