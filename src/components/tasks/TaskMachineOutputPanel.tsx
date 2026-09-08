"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { useApiToast } from "@/components/ui/ToastProvider";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import {
  MACHINE_FORMAT_OPTIONS,
  pickPreferredSampleOutput,
} from "@/lib/services/task-machine-output-utils";
import { cn } from "@/lib/utils";

type MachineArtifact = {
  id: string;
  artifactType: string;
  stitchCount: number | null;
  machineFormat: string | null;
  sampleQty: number | null;
  wastageQty: number | null;
  storageKey?: string | null;
  uploadedAtUtc: string;
};

type TaskMachineOutputPanelProps = {
  taskId: string;
  canEdit?: boolean;
  compact?: boolean;
  /** Notifies parent while a debounced auto-save is in flight (e.g. End Task). */
  onBusyChange?: (busy: boolean) => void;
};

type DraftSnapshot = {
  stitchCount: string;
  machineFormat: string | null;
  sampleQty: string;
  wastageQty: string;
};

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function snapshotFromArtifact(artifact: MachineArtifact | null): DraftSnapshot {
  return {
    stitchCount: artifact?.stitchCount != null ? String(artifact.stitchCount) : "",
    machineFormat: artifact?.machineFormat ?? null,
    sampleQty: artifact?.sampleQty != null ? String(artifact.sampleQty) : "",
    wastageQty: artifact?.wastageQty != null ? String(artifact.wastageQty) : "",
  };
}

function draftsEqual(a: DraftSnapshot, b: DraftSnapshot): boolean {
  return (
    a.stitchCount === b.stitchCount &&
    a.machineFormat === b.machineFormat &&
    a.sampleQty === b.sampleQty &&
    a.wastageQty === b.wastageQty
  );
}

function hasAnyValue(draft: DraftSnapshot): boolean {
  return (
    !!draft.stitchCount.trim() ||
    !!draft.sampleQty.trim() ||
    !!draft.wastageQty.trim() ||
    !!draft.machineFormat?.trim()
  );
}

export function TaskMachineOutputPanel({
  taskId,
  canEdit = true,
  compact = false,
  onBusyChange,
}: TaskMachineOutputPanelProps) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [stitchCount, setStitchCount] = useState("");
  const [machineFormat, setMachineFormat] = useState<string | null>(null);
  const [sampleQty, setSampleQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const lastSavedRef = useRef<DraftSnapshot>(snapshotFromArtifact(null));
  const artifactIdRef = useRef<string | null>(null);
  const saveGenRef = useRef(0);

  const artifactsQuery = useQuery({
    queryKey: ["tasks", taskId, "artifacts"],
    queryFn: () => apiGet<MachineArtifact[]>(`/api/tasks/${taskId}/artifacts`),
    enabled: !!taskId,
  });

  const machineArtifact = useMemo(
    () => pickPreferredSampleOutput(artifactsQuery.data ?? []),
    [artifactsQuery.data],
  );

  const artifactSeed = machineArtifact?.id ?? "none";
  const [syncedArtifactSeed, setSyncedArtifactSeed] = useState(artifactSeed);
  if (artifactSeed !== syncedArtifactSeed) {
    setSyncedArtifactSeed(artifactSeed);
    const next = snapshotFromArtifact(machineArtifact);
    setStitchCount(next.stitchCount);
    setMachineFormat(next.machineFormat);
    setSampleQty(next.sampleQty);
    setWastageQty(next.wastageQty);
    lastSavedRef.current = next;
    artifactIdRef.current = machineArtifact?.id ?? null;
    setSaveState("idle");
  }

  const draft: DraftSnapshot = {
    stitchCount,
    machineFormat,
    sampleQty,
    wastageQty,
  };

  useEffect(() => {
    onBusyChange?.(saveState === "saving");
    return () => onBusyChange?.(false);
  }, [onBusyChange, saveState]);

  useEffect(() => {
    if (!canEdit || !taskId) return;
    if (draftsEqual(draft, lastSavedRef.current)) {
      setSaveState((prev) =>
        prev === "saving" ? (artifactIdRef.current ? "saved" : "idle") : prev,
      );
      return;
    }
    // Don't create an empty SAMPLE_OUTPUT row until the user enters something.
    if (!artifactIdRef.current && !hasAnyValue(draft)) {
      setSaveState((prev) => (prev === "saving" ? "idle" : prev));
      return;
    }

    const gen = ++saveGenRef.current;
    setSaveState("saving");

    const timer = window.setTimeout(() => {
      void (async () => {
        const payload = {
          stitchCount: parseOptionalInt(draft.stitchCount) ?? null,
          machineFormat: draft.machineFormat?.trim() || null,
          sampleQty: parseOptionalInt(draft.sampleQty) ?? null,
          wastageQty: parseOptionalInt(draft.wastageQty) ?? null,
        };

        try {
          if (artifactIdRef.current) {
            await apiPatch(`/api/tasks/${taskId}/artifacts/${artifactIdRef.current}`, payload);
          } else {
            const created = await apiPost<MachineArtifact>(`/api/tasks/${taskId}/artifacts`, {
              artifactType: "SAMPLE_OUTPUT",
              stitchCount: payload.stitchCount ?? undefined,
              machineFormat: payload.machineFormat ?? undefined,
              sampleQty: payload.sampleQty ?? undefined,
              wastageQty: payload.wastageQty ?? undefined,
            });
            artifactIdRef.current = created.id;
          }

          if (saveGenRef.current !== gen) return;
          lastSavedRef.current = draft;
          setSaveState("saved");
          await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "artifacts"] });
        } catch (error) {
          if (saveGenRef.current !== gen) return;
          setSaveState("error");
          toast.errorFromApi(error, "Failed to auto-save machine output");
        }
      })();
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canEdit, draft, queryClient, taskId, toast]);

  const statusLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed — edit to retry"
          : canEdit
            ? "Changes save automatically"
            : null;

  const body = (
    <div className="space-y-2">
      <div
        className={cn(
          "grid min-w-0 gap-3",
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        )}
      >
        <FormTextField
          id={`machine-stitch-${taskId}`}
          label="Stitch count"
          type="number"
          min={0}
          inputMode="numeric"
          value={stitchCount}
          onChange={(e) => setStitchCount(e.target.value)}
          disabled={!canEdit}
          placeholder="e.g. 12500"
        />
        <FormSelect
          id={`machine-format-${taskId}`}
          label="Machine format"
          value={machineFormat}
          onValueChange={setMachineFormat}
          options={[...MACHINE_FORMAT_OPTIONS]}
          placeholder="Select format…"
          disabled={!canEdit}
        />
        <FormTextField
          id={`machine-sample-qty-${taskId}`}
          label="Sample qty"
          type="number"
          min={0}
          inputMode="numeric"
          value={sampleQty}
          onChange={(e) => setSampleQty(e.target.value)}
          disabled={!canEdit}
          placeholder="Pieces produced"
        />
        <FormTextField
          id={`machine-wastage-${taskId}`}
          label="Wastage qty"
          type="number"
          min={0}
          inputMode="numeric"
          value={wastageQty}
          onChange={(e) => setWastageQty(e.target.value)}
          disabled={!canEdit}
          placeholder="Rejected / scrap"
        />
      </div>
      {statusLabel ? (
        <p
          className={cn(
            "m-0 text-xs",
            saveState === "error" ? "text-destructive" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {statusLabel}
        </p>
      ) : null}
    </div>
  );

  if (compact) {
    return <div className="space-y-2">{body}</div>;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Machine output</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
