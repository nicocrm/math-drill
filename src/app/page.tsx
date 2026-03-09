import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <PageLayout title="MathDrill" subtitle="Practice math exercises">
      <Card>
        <p className="text-muted-foreground">No exercise sets yet.</p>
        <Button href="/admin" variant="primary" size="lg" className="mt-4">
          Go to Upload
        </Button>
      </Card>
    </PageLayout>
  );
}
