/**
 * Run before the API in Playwright’s webServer command. Playwright starts the
 * web server in plugin setup *before* globalSetup runs, so the marker must be
 * created here — not only in globalSetup.
 */
import { rm, mkdir, writeFile } from "fs/promises";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const markerPath = path.join(root, ".e2e-storage-dir");

export async function ensureE2eStorage(): Promise<void> {
  const ex = path.join(os.tmpdir(), "math-drill-e2e-exercises");
  const inDir = path.join(os.tmpdir(), "math-drill-e2e-intake");
  await rm(ex, { recursive: true, force: true });
  await rm(inDir, { recursive: true, force: true });
  await mkdir(ex, { recursive: true });
  await mkdir(inDir, { recursive: true });
  await writeFile(
    markerPath,
    JSON.stringify({ exercisesDir: ex, intakeDir: inDir }, null, 0),
    "utf-8"
  );
}

ensureE2eStorage()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
