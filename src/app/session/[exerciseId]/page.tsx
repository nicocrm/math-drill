import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  return (
    <PageLayout
      title="Exercise session"
      subtitle={`Exercise ID: ${exerciseId}`}
    >
      <Card>
        <p className="text-muted-foreground">Not implemented</p>
        <Button href="/" variant="outline" size="md" className="mt-4">
          Back to Home
        </Button>
      </Card>
    </PageLayout>
  );
}
