import { mkdir, readdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { ExerciseSet } from "../types/exercise";
import type { ExerciseStorage } from "../storage";

export class LocalExerciseStorage implements ExerciseStorage {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? process.env.EXERCISES_DIR ?? path.join(process.cwd(), "exercises");
  }

  private async ensureDir(): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    return this.dir;
  }

  async list(): Promise<ExerciseSet[]> {
    const dir = await this.ensureDir();
    const entries = await readdir(dir, { withFileTypes: true });
    const exercises: ExerciseSet[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const id = entry.name.replace(/\.json$/, "");
        const exercise = await this.get(id);
        if (exercise) exercises.push(exercise);
      }
    }

    return exercises.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async listByUser(userId: string): Promise<ExerciseSet[]> {
    const all = await this.list();
    return all.filter((ex) => ex.createdBy === userId);
  }

  async get(id: string): Promise<ExerciseSet | null> {
    const dir = await this.ensureDir();
    const filePath = path.join(dir, `${id}.json`);

    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as ExerciseSet;
    } catch {
      return null;
    }
  }

  async save(exercise: ExerciseSet): Promise<void> {
    const dir = await this.ensureDir();
    const filePath = path.join(dir, `${exercise.id}.json`);
    await writeFile(filePath, JSON.stringify(exercise, null, 2), "utf-8");
  }

  async delete(id: string): Promise<boolean> {
    const dir = await this.ensureDir();
    const filePath = path.join(dir, `${id}.json`);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
