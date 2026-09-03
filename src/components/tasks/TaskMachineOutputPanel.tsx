"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { useApiToast } from "@/components/ui/ToastProvider";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { MACHINE_FORMAT_OPTIONS } from "@/lib/services/task-machine-output-utils";
import { cn } from "@/lib/utils";

type MachineArtifact = {
  id: string;
  artifactType: string;
  stitchCount: number | null;
  machineFormat: string | null;
  sampleQty: number | null;
  wastageQty: number | null;
  uploadedAtUtc: string;
};

type TaskMachineOutputPanelProps = {
  taskId: string;
  canEdit?: boolean;
  compact?: boolean;
};

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function findMachineArtifact(artifacts: MachineArtifact[]): MachineArtifact | null {
  const sampleOutputs = artifacts.filter((a) => a.artifactType === "SAMPLE_OUTPUT");
  if (sampleOutputs.length === 0) return null;
  return [...sampleOutputs].sort(
    (a, b) => new Date(b.uploadedAtUtc).getTime() - new Date(a.uploadedAtUtc).getTime(),
  )[0];
}

export function TaskMachineOutputPanel({
  taskId,
  canEdit = true,
  compact = false,
}: TaskMachineOutputPanelProps) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [stitchCount, setStitchCount] = useState("");
  const [machineFormat, setMachineFormat] = useState<string | null>(null);
  const [sampleQty, setSampleQty] = useState("");
  const [wastageQty, setWastageQty] = useState("");

  const artifactsQuery = useQuery({
    queryKey: ["tasks", taskId, "artifacts"],
    queryFn: () => apiGet<MachineArtifact[]>(`/api/tasks/${taskId}/artifacts`),
    enabled: !!taskId,
  });

  const machineArtifact = useMemo(
    () => findMachineArtifact(artifactsQuery.data ?? []),
    [artifactsQuery.data],
  );

  const artifactSeed = machineArtifact?.id ?? "none";
  const [syncedArtifactSeed, setSyncedArtifactSeed] = useState(artifactSeed);
  if (artifactSeed !== syncedArtifactSeed) {
    setSyncedArtifactSeed(artifactSeed);
    setStitchCount(machineArtifact?.stitchCount != null ? String(machineArtifact.stitchCount) : "");
    setMachineFormat(machineArtifact?.machineFormat ?? null);
    setSampleQty(machineArtifact?.sampleQty != null ? String(machineArtifact.sampleQty) : "");
    setWastageQty(machineArtifact?.wastageQty != null ? String(machineArtifact.wastageQty) : "");
  }

  async function handleSave() {
    if (!canEdit || saving) return;

    const payload = {
      stitchCount: parseOptionalInt(stitchCount),
      machineFormat: machineFormat?.trim() || undefined,
      sampleQty: parseOptionalInt(sampleQty),
      wastageQty: parseOptionalInt(wastageQty),
    };

    const hasAny =
      payload.stitchCount != null ||
      payload.sampleQty != null ||
      payload.wastageQty != null ||
      !!payload.machineFormat;

    if (!hasAny) {
      toast.error("Enter at least one machine output value before saving.");
      return;
    }

    setSaving(true);
    try {
      if (machineArtifact) {
        await apiPatch(`/api/tasks/${taskId}/artifacts/${machineArtifact.id}`, payload);
      } else {
        await apiPost(`/api/tasks/${taskId}/artifacts`, {
          artifactType: "SAMPLE_OUTPUT",
          ...payload,
        });
      }
      toast.success("Machine output saved");
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "artifacts"] });
    } catch (error) {
      toast.errorFromApi(error, "Failed to save machine output");
    } finally {
      setSaving(false);
    }
  }

  const body = (
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
        disabled={!canEdit || saving}
        placeholder="e.g. 12500"
      />
      <FormSelect
        id={`machine-format-${taskId}`}
        label="Machine format"
        value={machineFormat}
        onValueChange={setMachineFormat}
        options={[...MACHINE_FORMAT_OPTIONS]}
        placeholder="Select format…"
        disabled={!canEdit || saving}
      />
      <FormTextField
        id={`machine-sample-qty-${taskId}`}
        label="Sample qty"
        type="number"
        min={0}
        inputMode="numeric"
        value={sampleQty}
        onChange={(e) => setSampleQty(e.target.value)}
        disabled={!canEdit || saving}
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
        disabled={!canEdit || saving}
        placeholder="Rejected / scrap"
      />
      {canEdit ? (
        <div className={cn(compact ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-4")}>
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save machine output"}
          </Button>
        </div>
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
