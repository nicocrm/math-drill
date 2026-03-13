import { useSearchParams } from "react-router";
import { PageLayout } from "@/components/PageLayout";
import { ExercisePlayer } from "@/components/ExercisePlayer";
import { Button } from "@/components/ui/Button";

export default function SessionPage() {
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get("id");

  if (!exerciseId) {
    return (
      <PageLayout title="Exercise session" subtitle="">
        <p className="text-muted-foreground">No exercise selected.</p>
        <Button href="/" variant="outline" size="md" className="mt-4">
          Back to Home
        </Button>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Exercise session"
      subtitle="Answer the questions below"
    >
      <ExercisePlayer exerciseId={exerciseId} />
    </PageLayout>
  );
}
