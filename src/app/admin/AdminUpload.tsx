"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DropZone } from "@/components/DropZone";
import { IngestionStatus } from "@/components/IngestionStatus";

export function AdminUpload() {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <DropZone onJobStarted={(id) => setJobId(id)} />
      {jobId && <IngestionStatus jobId={jobId} />}
      <Button href="/" variant="outline" size="md">
        Back to Home
      </Button>
    </div>
  );
}
