import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getExercise, deleteExercise } from "@/lib/exerciseStore";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const exercise = await getExercise(id);

  if (!exercise) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (exercise.createdBy && exercise.createdBy !== userId) {
    return NextResponse.json(
      { error: "Not authorized to delete this exercise" },
      { status: 403 }
    );
  }

  await deleteExercise(id);
  return NextResponse.json({ ok: true });
}
