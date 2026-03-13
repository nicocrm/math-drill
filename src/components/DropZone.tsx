
import { useCallback, useState } from "react";
import { useAuth } from "@clerk/react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/Card";
import { apiUrl, authHeaders } from "@/lib/api";

interface DropZoneProps {
  onJobStarted?: (jobId: string) => void;
}

export function DropZone({ onJobStarted }: DropZoneProps) {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setUploading(true);
      try {
        const token = await getToken();
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(apiUrl("/api/ingest"), {
          method: "POST",
          headers: authHeaders(token),
          body: formData,
        });
        if (!res.ok) {
          throw new Error("Upload failed");
        }
        const data = (await res.json()) as { jobId: string };
        if (data.jobId) {
          onJobStarted?.(data.jobId);
        }
      } catch {
        setUploading(false);
      } finally {
        setUploading(false);
      }
    },
    [onJobStarted, getToken]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <Card
      {...getRootProps()}
      className={`cursor-pointer border-2 border-dashed transition-all duration-150 ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-zinc-300 hover:border-primary/50 dark:border-zinc-600 dark:hover:border-primary/50"
      } ${uploading ? "pointer-events-none opacity-60" : ""}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <svg
          className="h-12 w-12 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-foreground font-medium">
          {uploading
            ? "Uploading..."
            : isDragActive
              ? "Drop your PDF here"
              : "Drag & drop a PDF here"}
        </p>
        <p className="text-sm text-muted-foreground">or click to browse</p>
      </div>
    </Card>
  );
}
