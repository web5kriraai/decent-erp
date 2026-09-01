"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { useApiToast } from "@/components/ui/ToastProvider";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { FileIcon, Loader2Icon, UploadCloudIcon } from "lucide-react";

type TaskArtifactType =
  | "SKETCH_VERSION"
  | "PUNCHING_FILE"
  | "SAMPLE_OUTPUT"
  | "AUDIO_NOTE"
  | "VIDEO_REF";

type TaskArtifact = {
  id: string;
  artifactType: TaskArtifactType;
  fileName?: string | null;
  storageKey?: string | null;
  stitchCount?: number | null;
  machineFormat?: string | null;
  versionNo?: number | null;
  uploadedAtUtc: string;
};

const ARTIFACT_TYPE_OPTIONS: { value: TaskArtifactType; label: string }[] = [
  { value: "SKETCH_VERSION", label: "Sketch Version" },
  { value: "PUNCHING_FILE", label: "Punching / EMB / DST" },
  { value: "SAMPLE_OUTPUT", label: "Sample Output" },
  { value: "AUDIO_NOTE", label: "Audio Note" },
  { value: "VIDEO_REF", label: "Video Reference" },
];

const ACCEPTED_FILE_TYPES =
  ".jpg,.jpeg,.png,.webp,.pdf,.emb,.dst,image/*,application/pdf";

type TaskArtifactPanelProps = {
  taskId: string;
  designId: string;
  canUpload?: boolean;
  subProcessCode?: string;
  compact?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
};

export function TaskArtifactPanel({
  taskId,
  designId,
  canUpload = true,
  subProcessCode,
  compact = false,
  onUploadingChange,
}: TaskArtifactPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [artifactType, setArtifactType] = useState<TaskArtifactType>(
    subProcessCode?.includes("PUNCH")
      ? "PUNCHING_FILE"
      : subProcessCode?.includes("SAMPLE") || subProcessCode?.includes("MACHINE")
        ? "SAMPLE_OUTPUT"
        : "SKETCH_VERSION",
  );
  const [stitchCount, setStitchCount] = useState("");
  const [machineFormat, setMachineFormat] = useState("");
  const [sampleQty, setSampleQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");

  const artifactsQuery = useQuery({
    queryKey: ["tasks", taskId, "artifacts"],
    queryFn: () => apiGet<TaskArtifact[]>(`/api/tasks/${taskId}/artifacts`),
    enabled: !!taskId,
  });

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setActiveFileName(file.name);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch(`/api/designs/${designId}/images`, {
          method: "POST",
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) {
          const message =
            typeof uploadJson.error === "string"
              ? uploadJson.error
              : uploadRes.status === 503
                ? "File storage is unavailable. Contact your administrator or start MinIO."
                : "Upload failed";
          throw new Error(message);
        }

        const storageKey = uploadJson.data?.storageKey as string | undefined;
        const fileName = uploadJson.data?.fileName ?? file.name;

        await apiPost(`/api/tasks/${taskId}/artifacts`, {
          artifactType,
          fileName,
          storageKey,
          stitchCount: stitchCount ? Number(stitchCount) : undefined,
          machineFormat: machineFormat.trim() || undefined,
          sampleQty: sampleQty ? Number(sampleQty) : undefined,
          wastageQty: wastageQty ? Number(wastageQty) : undefined,
        });

        toast.success("File uploaded", `${fileName} is linked to this task.`);
        setActiveFileName(null);
        if (inputRef.current) inputRef.current.value = "";
        await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "artifacts"] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.designs.images(designId) });
      } catch (error) {
        toast.errorFromApi(error, "Upload failed");
        setActiveFileName(null);
      } finally {
        setUploading(false);
      }
    },
    [
      artifactType,
      designId,
      machineFormat,
      queryClient,
      sampleQty,
      stitchCount,
      taskId,
      toast,
      wastageQty,
    ],
  );

  function handleFiles(files: FileList | null) {
    if (!files?.length || !canUpload || uploading) return;
    void uploadFile(files[0]);
  }

  const artifacts = artifactsQuery.data ?? [];
  const uploadedArtifacts = artifacts.filter((a) => !!a.storageKey);

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {canUpload ? (
        <div className="space-y-4">
          <div
            className={cn(
              "grid gap-3",
              compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
            )}
          >
            <FormSelect
              id="artifactType"
              label="File Type"
              value={artifactType}
              onValueChange={(v) => setArtifactType(v as TaskArtifactType)}
              options={ARTIFACT_TYPE_OPTIONS}
              disabled={uploading}
            />

            {artifactType === "PUNCHING_FILE" ? (
              <>
                <FormTextField
                  id="stitchCount"
                  label="Stitch Count"
                  type="number"
                  min={0}
                  value={stitchCount}
                  onChange={(e) => setStitchCount(e.target.value)}
                  placeholder="e.g. 125000"
                  disabled={uploading}
                />
                <FormTextField
                  id="machineFormat"
                  label="Machine Format"
                  value={machineFormat}
                  onChange={(e) => setMachineFormat(e.target.value)}
                  placeholder="e.g. Tajima / Wilcom"
                  disabled={uploading}
                  fieldClassName="sm:col-span-2"
                />
              </>
            ) : null}

            {artifactType === "SAMPLE_OUTPUT" ? (
              <>
                <FormTextField
                  id="sampleQty"
                  label="Sample Qty"
                  type="number"
                  min={0}
                  value={sampleQty}
                  onChange={(e) => setSampleQty(e.target.value)}
                  disabled={uploading}
                />
                <FormTextField
                  id="wastageQty"
                  label="Wastage Qty"
                  type="number"
                  min={0}
                  value={wastageQty}
                  onChange={(e) => setWastageQty(e.target.value)}
                  disabled={uploading}
                />
              </>
            ) : null}
          </div>

          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-5 text-center transition-colors",
              dragOver && "border-primary bg-primary/5",
              uploading && "border-primary/40 bg-primary/5",
              compact && "py-4",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragOver(true);
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
              accept={ACCEPTED_FILE_TYPES}
              hidden
              disabled={!canUpload || uploading}
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <>
                <Loader2Icon className="size-8 animate-spin text-primary" aria-hidden />
                <div className="flex max-w-md items-center gap-2 text-sm">
                  <FileIcon className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate font-medium">
                    Uploading {activeFileName ?? "file"}…
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Please wait — submit will unlock once the upload finishes.
                </p>
              </>
            ) : (
              <>
                <UploadCloudIcon
                  className={cn("size-8 text-muted-foreground", dragOver && "text-primary")}
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  Drag & drop a file here, or browse to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, PDF, EMB, DST — max 20 MB. Files upload automatically.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canUpload}
                  onClick={() => inputRef.current?.click()}
                >
                  Browse Files
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {artifactsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading uploaded files…</p>
        ) : uploadedArtifacts.length === 0 ? (
          !uploading ? (
            <p className="text-sm text-muted-foreground">No task files uploaded yet.</p>
          ) : null
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background">
            {uploadedArtifacts.map((artifact) => (
              <li
                key={artifact.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {artifact.fileName ?? "Unnamed file"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ARTIFACT_TYPE_OPTIONS.find((o) => o.value === artifact.artifactType)?.label ??
                      artifact.artifactType}
                    {artifact.stitchCount != null ? ` · ${artifact.stitchCount} stitches` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(artifact.uploadedAtUtc).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function useTaskHasFiles(taskId: string, designId: string, enabled = true) {
  const artifactsQuery = useQuery({
    queryKey: ["tasks", taskId, "artifacts"],
    queryFn: () => apiGet<TaskArtifact[]>(`/api/tasks/${taskId}/artifacts`),
    enabled: enabled && !!taskId,
  });

  const artifactWithFile = artifactsQuery.data?.some((a) => !!a.storageKey) ?? false;

  return {
    hasFiles: artifactWithFile,
    isLoading: artifactsQuery.isLoading,
    refetch: artifactsQuery.refetch,
  };
}
