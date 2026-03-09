import { NextResponse } from "next/server";
import { listExercises } from "@/lib/exerciseStore";

export async function GET() {
  const exercises = await listExercises();
  return NextResponse.json({ exercises });
}
