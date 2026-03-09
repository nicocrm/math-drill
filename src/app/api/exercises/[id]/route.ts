import { NextResponse } from "next/server";
import { getExercise } from "@/lib/exerciseStore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const exercise = await getExercise(id);

  if (!exercise) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(exercise);
}
