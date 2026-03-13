import { mkdir, readdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { ExerciseSet } from "@/types/exercise";

const EXERCISES_DIR =
  process.env.EXERCISES_DIR ?? path.join(process.cwd(), "exercises");

async function ensureExercisesDir(): Promise<string> {
  await mkdir(EXERCISES_DIR, { recursive: true });
  return EXERCISES_DIR;
}

export async function listExercises(): Promise<ExerciseSet[]> {
  const dir = await ensureExercisesDir();
  const entries = await readdir(dir, { withFileTypes: true });
  const exercises: ExerciseSet[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const id = entry.name.replace(/\.json$/, "");
      const exercise = await getExercise(id);
      if (exercise) exercises.push(exercise);
    }
  }

  return exercises.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getExercise(id: string): Promise<ExerciseSet | null> {
  const dir = await ensureExercisesDir();
  const filePath = path.join(dir, `${id}.json`);

  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data) as ExerciseSet;
  } catch {
    return null;
  }
}

export async function saveExercise(exercise: ExerciseSet): Promise<void> {
  const dir = await ensureExercisesDir();
  const filePath = path.join(dir, `${exercise.id}.json`);
  await writeFile(filePath, JSON.stringify(exercise, null, 2), "utf-8");
}

export async function deleteExercise(id: string): Promise<boolean> {
  const dir = await ensureExercisesDir();
  const filePath = path.join(dir, `${id}.json`);
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listExercisesByUser(
  userId: string
): Promise<ExerciseSet[]> {
  const all = await listExercises();
  return all.filter((ex) => ex.createdBy === userId);
}
