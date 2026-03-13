import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listExercises, listExercisesByUser } from "@/lib/exerciseStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine");

  if (mine) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const exercises = await listExercisesByUser(userId);
    return NextResponse.json({ exercises });
  }

  const exercises = await listExercises();
  return NextResponse.json({ exercises });
}
