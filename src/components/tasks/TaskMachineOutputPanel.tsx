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
  needleCount?: number | null;
  colorCount?: number | null;
  hoopSize?: string | null;
  softwareName?: string | null;
  stitchDensity?: number | string | null;
  storageKey?: string | null;
  uploadedAtUtc: string;
};

type TaskMachineOutputPanelProps = {
  taskId: string;
  canEdit?: boolean;
  compact?: boolean;
  /** Prefer PUNCHING_FILE for digitizing stages. */
  preferredArtifactType?: "SAMPLE_OUTPUT" | "PUNCHING_FILE";
  onBusyChange?: (busy: boolean) => void;
};

type DraftSnapshot = {
  stitchCount: string;
  machineFormat: string | null;
  sampleQty: string;
  wastageQty: string;
  needleCount: string;
  colorCount: string;
  hoopSize: string;
  softwareName: string;
  stitchDensity: string;
};

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseOptionalFloat(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function snapshotFromArtifact(artifact: MachineArtifact | null): DraftSnapshot {
  return {
    stitchCount: artifact?.stitchCount != null ? String(artifact.stitchCount) : "",
    machineFormat: artifact?.machineFormat ?? null,
    sampleQty: artifact?.sampleQty != null ? String(artifact.sampleQty) : "",
    wastageQty: artifact?.wastageQty != null ? String(artifact.wastageQty) : "",
    needleCount: artifact?.needleCount != null ? String(artifact.needleCount) : "",
    colorCount: artifact?.colorCount != null ? String(artifact.colorCount) : "",
    hoopSize: artifact?.hoopSize ?? "",
    softwareName: artifact?.softwareName ?? "",
    stitchDensity:
      artifact?.stitchDensity != null ? String(artifact.stitchDensity) : "",
  };
}

function draftsEqual(a: DraftSnapshot, b: DraftSnapshot): boolean {
  return (
    a.stitchCount === b.stitchCount &&
    a.machineFormat === b.machineFormat &&
    a.sampleQty === b.sampleQty &&
    a.wastageQty === b.wastageQty &&
    a.needleCount === b.needleCount &&
    a.colorCount === b.colorCount &&
    a.hoopSize === b.hoopSize &&
    a.softwareName === b.softwareName &&
    a.stitchDensity === b.stitchDensity
  );
}

function hasAnyValue(draft: DraftSnapshot): boolean {
  return Object.values(draft).some((v) => !!String(v ?? "").trim());
}

export function TaskMachineOutputPanel({
  taskId,
  canEdit = true,
  compact = false,
  preferredArtifactType = "SAMPLE_OUTPUT",
  onBusyChange,
}: TaskMachineOutputPanelProps) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [stitchCount, setStitchCount] = useState("");
  const [machineFormat, setMachineFormat] = useState<string | null>(null);
  const [sampleQty, setSampleQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");
  const [needleCount, setNeedleCount] = useState("");
  const [colorCount, setColorCount] = useState("");
  const [hoopSize, setHoopSize] = useState("");
  const [softwareName, setSoftwareName] = useState("");
  const [stitchDensity, setStitchDensity] = useState("");
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
    () => pickPreferredSampleOutput(artifactsQuery.data ?? [], preferredArtifactType),
    [artifactsQuery.data, preferredArtifactType],
  );

  const serverSnap = snapshotFromArtifact(machineArtifact);
  const artifactSeed = [
    machineArtifact?.id ?? "none",
    serverSnap.sampleQty,
    serverSnap.wastageQty,
    serverSnap.stitchCount,
    serverSnap.machineFormat ?? "",
    serverSnap.needleCount,
    serverSnap.colorCount,
    serverSnap.hoopSize,
    serverSnap.softwareName,
    serverSnap.stitchDensity,
  ].join("|");
  const [syncedArtifactSeed, setSyncedArtifactSeed] = useState(artifactSeed);
  if (artifactSeed !== syncedArtifactSeed) {
    setSyncedArtifactSeed(artifactSeed);
    const localDraft: DraftSnapshot = {
      stitchCount,
      machineFormat,
      sampleQty,
      wastageQty,
      needleCount,
      colorCount,
      hoopSize,
      softwareName,
      stitchDensity,
    };
    artifactIdRef.current = machineArtifact?.id ?? null;
    if (draftsEqual(localDraft, lastSavedRef.current)) {
      setStitchCount(serverSnap.stitchCount);
      setMachineFormat(serverSnap.machineFormat);
      setSampleQty(serverSnap.sampleQty);
      setWastageQty(serverSnap.wastageQty);
      setNeedleCount(serverSnap.needleCount);
      setColorCount(serverSnap.colorCount);
      setHoopSize(serverSnap.hoopSize);
      setSoftwareName(serverSnap.softwareName);
      setStitchDensity(serverSnap.stitchDensity);
      lastSavedRef.current = serverSnap;
      setSaveState(hasAnyValue(serverSnap) ? "saved" : "idle");
    }
  }

  const draft: DraftSnapshot = {
    stitchCount,
    machineFormat,
    sampleQty,
    wastageQty,
    needleCount,
    colorCount,
    hoopSize,
    softwareName,
    stitchDensity,
  };

  const showDigitizing = preferredArtifactType === "PUNCHING_FILE";
  const showProductionQty = !showDigitizing;

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
    if (!artifactIdRef.current && !hasAnyValue(draft)) {
      setSaveState((prev) => (prev === "saving" ? "idle" : prev));
      return;
    }

    const gen = ++saveGenRef.current;
    setSaveState("saving");

    const timer = window.setTimeout(() => {
      void (async () => {
        const payload = showDigitizing
          ? {
              stitchCount: parseOptionalInt(draft.stitchCount) ?? null,
              machineFormat: draft.machineFormat?.trim() || null,
              needleCount: parseOptionalInt(draft.needleCount) ?? null,
              colorCount: parseOptionalInt(draft.colorCount) ?? null,
              hoopSize: draft.hoopSize.trim() || null,
              softwareName: draft.softwareName.trim() || null,
              stitchDensity: parseOptionalFloat(draft.stitchDensity) ?? null,
            }
          : {
              sampleQty: parseOptionalInt(draft.sampleQty) ?? null,
              wastageQty: parseOptionalInt(draft.wastageQty) ?? null,
            };

        try {
          if (artifactIdRef.current) {
            await apiPatch(`/api/tasks/${taskId}/artifacts/${artifactIdRef.current}`, payload);
          } else {
            const createType =
              machineArtifact?.artifactType === "PUNCHING_FILE"
                ? "PUNCHING_FILE"
                : preferredArtifactType;
            const created = await apiPost<MachineArtifact>(`/api/tasks/${taskId}/artifacts`, {
              artifactType: createType,
              ...Object.fromEntries(
                Object.entries(payload).map(([k, v]) => [k, v ?? undefined]),
              ),
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
  }, [
    canEdit,
    draft,
    machineArtifact?.artifactType,
    preferredArtifactType,
    queryClient,
    showDigitizing,
    taskId,
    toast,
  ]);

  const statusLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed - edit to retry"
          : canEdit
            ? "Changes save automatically"
            : null;

  const body = (
    <div className="space-y-2">
      <div
        className={cn(
          "grid min-w-0 items-start gap-3",
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {showDigitizing ? (
          <>
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
              id={`machine-needles-${taskId}`}
              label="Needle count"
              type="number"
              min={0}
              inputMode="numeric"
              value={needleCount}
              onChange={(e) => setNeedleCount(e.target.value)}
              disabled={!canEdit}
              placeholder="Wilcom needles"
            />
            <FormTextField
              id={`machine-colors-${taskId}`}
              label="Color count"
              type="number"
              min={0}
              inputMode="numeric"
              value={colorCount}
              onChange={(e) => setColorCount(e.target.value)}
              disabled={!canEdit}
              placeholder="Thread colors"
            />
            <FormTextField
              id={`machine-hoop-${taskId}`}
              label="Hoop size"
              value={hoopSize}
              onChange={(e) => setHoopSize(e.target.value)}
              disabled={!canEdit}
              placeholder="130x180 mm"
            />
            <FormTextField
              id={`machine-density-${taskId}`}
              label="Stitch density"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={stitchDensity}
              onChange={(e) => setStitchDensity(e.target.value)}
              disabled={!canEdit}
              placeholder="stitches/mm"
            />
            <FormTextField
              id={`machine-software-${taskId}`}
              label="Software"
              value={softwareName}
              onChange={(e) => setSoftwareName(e.target.value)}
              disabled={!canEdit}
              placeholder="Wilcom / Hatch"
            />
          </>
        ) : null}
        {showProductionQty ? (
          <>
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
          </>
        ) : null}
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
        <CardTitle>
          {preferredArtifactType === "PUNCHING_FILE" ? "Punching / Wilcom output" : "Machine output"}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
