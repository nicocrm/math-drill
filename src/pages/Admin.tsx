import { useAuth, SignInButton } from "@clerk/react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AdminUpload } from "@/components/AdminUpload";

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <PageLayout title="Upload" subtitle="Upload a PDF to create exercise sets">
      {!isLoaded ? (
        <Card>
          <p className="text-muted-foreground">Loading...</p>
        </Card>
      ) : isSignedIn ? (
        <AdminUpload />
      ) : (
        <Card>
          <p className="text-muted-foreground">
            You need to sign in to upload exercises.
          </p>
          <SignInButton mode="modal">
            <button className="mt-4 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90">
              Sign in
            </button>
          </SignInButton>
          <Button href="/" variant="outline" size="md" className="mt-4 ml-2">
            Back to Home
          </Button>
        </Card>
      )}
    </PageLayout>
  );
}
