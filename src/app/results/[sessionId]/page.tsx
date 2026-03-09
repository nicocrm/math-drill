import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <PageLayout title="Results" subtitle={`Session ID: ${sessionId}`}>
      <Card>
        <p className="text-muted-foreground">Not implemented</p>
        <Button href="/" variant="outline" size="md" className="mt-4">
          Back to Home
        </Button>
      </Card>
    </PageLayout>
  );
}
