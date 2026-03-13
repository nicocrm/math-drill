import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { FileStorage } from "../storage";

export class LocalFileStorage implements FileStorage {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? process.env.INTAKE_DIR ?? path.join(process.cwd(), "intake");
  }

  async upload(key: string, data: Buffer): Promise<void> {
    const filePath = path.join(this.dir, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.dir, key);
    return readFile(filePath);
  }
}
