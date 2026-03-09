import { PageLayout } from "@/components/PageLayout";
import { ExercisePlayer } from "@/components/ExercisePlayer";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  return (
    <PageLayout
      title="Exercise session"
      subtitle="Answer the questions below"
    >
      <ExercisePlayer exerciseId={exerciseId} />
    </PageLayout>
  );
}
