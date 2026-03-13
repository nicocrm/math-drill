import { LocalExerciseStorage } from "@math-drill/core/storage/localExerciseStorage";
import type { ExerciseSet } from "@math-drill/core";

const storage = new LocalExerciseStorage();

export const listExercises = () => storage.list();
export const getExercise = (id: string) => storage.get(id);
export const saveExercise = (exercise: ExerciseSet) => storage.save(exercise);
export const deleteExercise = (id: string) => storage.delete(id);
export const listExercisesByUser = (userId: string) => storage.listByUser(userId);
