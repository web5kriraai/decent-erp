"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useApiToast } from "@/components/ui/ToastProvider";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isMachineOutputTask } from "@/lib/services/task-machine-output-utils";
import { cn } from "@/lib/utils";
import { FileIcon, Loader2Icon, UploadCloudIcon } from "lucide-react";

type MachineMetricsPayload = {
  stitchCount?: number;
  machineFormat?: string;
  sampleQty?: number;
  wastageQty?: number;
};

type TaskArtifactType = "SKETCH_VERSION" | "PUNCHING_FILE" | "SAMPLE_OUTPUT";

type TaskArtifact = {
  id: string;
  artifactType: TaskArtifactType;
  fileName?: string | null;
  storageKey?: string | null;
  stitchCount?: number | null;
  machineFormat?: string | null;
  sampleQty?: number | null;
  wastageQty?: number | null;
  uploadedAtUtc: string;
};

const ARTIFACT_TYPE_LABELS: Record<TaskArtifactType, string> = {
  SKETCH_VERSION: "Sketch Version",
  PUNCHING_FILE: "Punching / EMB / DST",
  SAMPLE_OUTPUT: "Sample Output",
};

const ACCEPTED_FILE_TYPES =
  ".jpg,.jpeg,.png,.webp,.pdf,.emb,.dst,image/*,application/pdf";

function resolveArtifactType(subProcessCode?: string): TaskArtifactType {
  const code = subProcessCode?.toUpperCase() ?? "";
  if (code.includes("PUNCH")) return "PUNCHING_FILE";
  if (code.includes("SAMPLE") || code.includes("MACHINE")) return "SAMPLE_OUTPUT";
  return "SKETCH_VERSION";
}

type TaskArtifactPanelProps = {
  taskId: string;
  designId: string;
  canUpload?: boolean;
  subProcessCode?: string;
  compact?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  machineMetrics?: MachineMetricsPayload;
};

export function TaskArtifactPanel({
  taskId,
  designId,
  canUpload = true,
  subProcessCode,
  compact = false,
  onUploadingChange,
  machineMetrics,
}: TaskArtifactPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const artifactType = useMemo(
    () => resolveArtifactType(subProcessCode),
    [subProcessCode],
  );

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
          ...(isMachineOutputTask(subProcessCode) ? machineMetrics : {}),
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
    [artifactType, designId, machineMetrics, queryClient, subProcessCode, taskId, toast],
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
                {ARTIFACT_TYPE_LABELS[artifactType]} · JPG, PNG, PDF, EMB, DST — max 20 MB
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
                    {ARTIFACT_TYPE_LABELS[artifact.artifactType] ?? artifact.artifactType}
                    {artifact.sampleQty != null || artifact.wastageQty != null ? (
                      <span>
                        {" "}
                        · Sample {artifact.sampleQty ?? "—"}, wastage {artifact.wastageQty ?? "—"}
                      </span>
                    ) : null}
                    {artifact.stitchCount != null ? (
                      <span> · {artifact.stitchCount.toLocaleString()} stitches</span>
                    ) : null}
                    {artifact.machineFormat ? <span> · {artifact.machineFormat}</span> : null}
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
