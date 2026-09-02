"use client";

import { useCallback, useRef, useState } from "react";
import { useApiToast } from "@/components/ui/ToastProvider";

type FileUploaderProps = {
  designId: string;
  onUploaded?: () => void;
  disabled?: boolean;
};

export function FileUploader({ designId, onUploaded, disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useApiToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "PRODUCT_IMAGE");
        const res = await fetch(`/api/designs/${designId}/images`, {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        toast.success("File uploaded", file.name);
        onUploaded?.();
      } catch (error) {
        toast.errorFromApi(error, "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [designId, onUploaded, toast],
  );

  function handleFiles(files: FileList | null) {
    if (!files?.length || disabled || uploading) return;
    void uploadFile(files[0]);
  }

  return (
    <div
      className={`file-uploader ${dragOver ? "file-uploader--drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        hidden
        disabled={disabled || uploading}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p style={{ margin: "0 0 0.75rem", color: "var(--color-neutral-600)" }}>
        Drag & drop or browse — JPEG, PNG, WebP (max 10 MB)
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : "Choose File"}
      </button>
    </div>
  );
}
