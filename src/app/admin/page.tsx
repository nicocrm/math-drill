import { PageLayout } from "@/components/PageLayout";
import { AdminUpload } from "./AdminUpload";

export default function AdminPage() {
  return (
    <PageLayout title="Upload" subtitle="Upload a PDF to create exercise sets">
      <AdminUpload />
    </PageLayout>
  );
}
