"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/Card";

export function DropZone() {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // TODO: implement upload
      console.log("Dropped files:", acceptedFiles);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: false,
  });

  return (
    <Card
      {...getRootProps()}
      className={`cursor-pointer border-2 border-dashed transition-all duration-150 ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-zinc-300 hover:border-primary/50 dark:border-zinc-600 dark:hover:border-primary/50"
      }`}
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
          {isDragActive ? "Drop your PDF here" : "Drag & drop a PDF here"}
        </p>
        <p className="text-sm text-muted-foreground">or click to browse</p>
      </div>
    </Card>
  );
}
