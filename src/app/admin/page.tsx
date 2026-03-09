import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/Button";
import { DropZone } from "@/components/DropZone";

export default function AdminPage() {
  return (
    <PageLayout title="Upload" subtitle="Upload a PDF to create exercise sets">
      <DropZone />
      <Button href="/" variant="outline" size="md">
        Back to Home
      </Button>
    </PageLayout>
  );
}
