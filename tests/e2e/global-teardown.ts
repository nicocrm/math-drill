import { unlink } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default async function globalTeardown() {
  try {
    await unlink(path.join(root, ".e2e-storage-dir"));
  } catch {
    // already removed
  }
}
