"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useApiToast } from "@/components/ui/ToastProvider";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

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

type TaskArtifactPanelProps = {
  taskId: string;
  designId: string;
  canUpload?: boolean;
  subProcessCode?: string;
};

export function TaskArtifactPanel({
  taskId,
  designId,
  canUpload = true,
  subProcessCode,
}: TaskArtifactPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [artifactType, setArtifactType] = useState<TaskArtifactType>(
    subProcessCode?.includes("PUNCH") ? "PUNCHING_FILE" : "SKETCH_VERSION",
  );
  const [stitchCount, setStitchCount] = useState("");
  const [machineFormat, setMachineFormat] = useState("");

  const artifactsQuery = useQuery({
    queryKey: ["tasks", taskId, "artifacts"],
    queryFn: () => apiGet<TaskArtifact[]>(`/api/tasks/${taskId}/artifacts`),
    enabled: !!taskId,
  });

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch(`/api/designs/${designId}/images`, {
          method: "POST",
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadJson.error ?? "Upload failed");

        const storageKey = uploadJson.data?.storageKey as string | undefined;
        const fileName = uploadJson.data?.fileName ?? file.name;

        await apiPost(`/api/tasks/${taskId}/artifacts`, {
          artifactType,
          fileName,
          storageKey,
          stitchCount: stitchCount ? Number(stitchCount) : undefined,
          machineFormat: machineFormat.trim() || undefined,
        });

        toast.success("Artifact registered", file.name);
        setStitchCount("");
        setMachineFormat("");
        await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "artifacts"] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.designs.images(designId) });
      } catch (error) {
        toast.errorFromApi(error, "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [artifactType, designId, machineFormat, queryClient, stitchCount, taskId, toast],
  );

  function handleFiles(files: FileList | null) {
    if (!files?.length || !canUpload || uploading) return;
    void uploadFile(files[0]);
  }

  const artifacts = artifactsQuery.data ?? [];

  return (
    <div className="space-y-3">
      {canUpload && (
        <div className="rounded-lg border border-dashed p-4">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <FormSelect
              id="artifactType"
              label="File Type"
              value={artifactType}
              onValueChange={(v) => setArtifactType(v as TaskArtifactType)}
              options={ARTIFACT_TYPE_OPTIONS}
            />
            {artifactType === "PUNCHING_FILE" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="stitchCount">Stitch Count</Label>
                  <Input
                    id="stitchCount"
                    type="number"
                    min={0}
                    value={stitchCount}
                    onChange={(e) => setStitchCount(e.target.value)}
                    placeholder="e.g. 125000"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="machineFormat">Machine Format</Label>
                  <Input
                    id="machineFormat"
                    value={machineFormat}
                    onChange={(e) => setMachineFormat(e.target.value)}
                    placeholder="e.g. Tajima / Wilcom"
                  />
                </div>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.emb,.dst,image/*,application/pdf"
            hidden
            disabled={!canUpload || uploading}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="mb-2 text-sm text-muted-foreground">
            JPG, PNG, PDF, EMB, DST — stored securely and linked to this task.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canUpload || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload Task File"}
          </Button>
        </div>
      )}

      {artifactsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading artifacts…</p>
      ) : artifacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No task files uploaded yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {artifacts.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{a.fileName ?? "Unnamed file"}</span>
                <span className="ml-2 text-muted-foreground">
                  {ARTIFACT_TYPE_OPTIONS.find((o) => o.value === a.artifactType)?.label ??
                    a.artifactType}
                </span>
                {a.stitchCount != null && (
                  <span className="ml-2 text-muted-foreground">· {a.stitchCount} stitches</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(a.uploadedAtUtc).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function useTaskHasFiles(taskId: string, designId: string, enabled = true) {
  const artifactsQuery = useQuery({
    queryKey: ["tasks", taskId, "artifacts"],
    queryFn: () => apiGet<TaskArtifact[]>(`/api/tasks/${taskId}/artifacts`),
    enabled: enabled && !!taskId,
  });
  const imagesQuery = useQuery({
    queryKey: queryKeys.designs.images(designId),
    queryFn: () => apiGet<unknown[]>(`/api/designs/${designId}/images`),
    enabled: enabled && !!designId,
  });

  // Match endTask: design images OR artifacts with a storage key
  const artifactWithFile = artifactsQuery.data?.some((a) => !!a.storageKey) ?? false;
  const imageCount = Array.isArray(imagesQuery.data) ? imagesQuery.data.length : 0;

  return {
    hasFiles: artifactWithFile || imageCount > 0,
    isLoading: artifactsQuery.isLoading || imagesQuery.isLoading,
  };
}
