"use client";

import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ROUTES } from "@/config/routes";
import { useCorrections } from "@/hooks/use-corrections";
import { OPEN_CORRECTION_STATUSES } from "@/lib/services/correction-queue-utils";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignSummary } from "@/lib/types/api";

type TaskQualityContextProps = {
  designId: string;
  subProcessCode?: string;
};

function ContextTile({
  label,
  status,
  lines,
  person,
}: {
  label: string;
  status?: string;
  lines: string[];
  person?: string | null;
}) {
  return (
    <article className="task-quality-tile">
      <div className="task-quality-tile-head">
        <span className="task-quality-tile-label">{label}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <ul className="task-quality-tile-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="task-quality-tile-person">{person?.trim() || "-"}</p>
    </article>
  );
}

export function TaskQualityContextPanel({ designId, subProcessCode }: TaskQualityContextProps) {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canViewCorrections = permissions.includes(PERMISSIONS.CORRECTION_RAISE);
  const isQualityStage = subProcessCode === "SAMPLE_CHECK" || subProcessCode === "PUNCH_CHECK";

  const designQuery = useQuery({
    queryKey: queryKeys.designs.detail(designId),
    queryFn: () => apiGet<DesignSummary>(`/api/designs/${designId}`),
    enabled: isQualityStage && !!designId,
  });

  const correctionsQuery = useCorrections(
    { designId },
    isQualityStage && canViewCorrections && !!designId,
  );

  if (!isQualityStage || !designQuery.data) return null;

  const design = designQuery.data;
  const openCorrections = (correctionsQuery.data ?? []).filter((c) =>
    (OPEN_CORRECTION_STATUSES as readonly string[]).includes(c.status),
  );
  const sketch = design.tasks?.find((t) => t.subProcess?.code === "SKETCH");
  const punch = design.tasks?.find((t) => t.subProcess?.code === "PUNCH");
  const machineSample =
    design.tasks?.find((t) => t.subProcess?.code === "MACHINE_SAMPLE") ??
    design.tasks?.find((t) => t.subProcess?.code === "RESAMPLE") ??
    design.tasks?.find((t) => t.subProcess?.code === "SAMPLE_RECEIVE");
  const matReq = design.tasks?.find((t) => t.subProcess?.code === "MAT_REQ");
  const punchArtifact = punch?.artifacts?.find(
    (row) => row.artifactType === "PUNCHING_FILE" || row.stitchCount != null || row.machineFormat,
  );
  const sampleArtifact =
    machineSample?.artifacts?.find((row) => row.sampleQty != null || row.wastageQty != null) ??
    machineSample?.artifacts?.find((row) => row.artifactType === "SAMPLE_OUTPUT");
  const punchLines = [
    [
      punchArtifact?.stitchCount != null
        ? `${punchArtifact.stitchCount.toLocaleString()} stitches`
        : null,
      punchArtifact?.machineFormat?.trim() || null,
    ]
      .filter(Boolean)
      .join(" · "),
    [
      punchArtifact?.hoopSize?.trim() ? `Hoop ${punchArtifact.hoopSize.trim()}` : null,
      punchArtifact?.needleCount != null ? `${punchArtifact.needleCount} needles` : null,
      punchArtifact?.colorCount != null ? `${punchArtifact.colorCount} colors` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  ].filter((line) => line.length > 0);
  const sampleReadyForCheck =
    subProcessCode === "SAMPLE_CHECK" && machineSample?.status === "CHECKING";
  const sampleQtyLine = [
    sampleArtifact?.sampleQty != null ? `${sampleArtifact.sampleQty} pcs` : null,
    sampleArtifact?.wastageQty != null ? `${sampleArtifact.wastageQty} wastage` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const sampleLines = [
    sampleReadyForCheck ? "Submitted for your check" : null,
    sampleQtyLine || null,
  ].filter((line): line is string => !!line);

  return (
    <AppCard
      title="Quality context"
      className="task-quality-context stack-section-sm"
      headerAction={
        <div className="flex flex-wrap justify-end gap-2">
          <AppButtonLink href={ROUTES.designs.detail(designId)} appVariant="outline" size="sm">
            Design files
          </AppButtonLink>
          {canViewCorrections && openCorrections.length > 0 ? (
            <AppButtonLink href={ROUTES.quality.corrections} appVariant="outline" size="sm">
              View corrections
            </AppButtonLink>
          ) : null}
        </div>
      }
    >
      <div className="task-quality-grid">
        {sketch ? (
          <ContextTile
            label="Sketch"
            status={sketch.status}
            lines={[]}
            person={sketch.assignedEmployee?.name}
          />
        ) : null}
        {punch ? (
          <ContextTile
            label="Punching"
            status={punch.status}
            lines={punchLines}
            person={punch.assignedEmployee?.name}
          />
        ) : null}
        {machineSample ? (
          <ContextTile
            label="Machine sample"
            status={machineSample.status}
            lines={sampleLines}
            person={machineSample.assignedEmployee?.name}
          />
        ) : null}
        {matReq ? (
          <ContextTile label="Material" status={matReq.status} lines={[]} person={matReq.assignedEmployee?.name} />
        ) : null}
        {canViewCorrections ? (
          <ContextTile
            label="Open corrections"
            lines={[openCorrections.length === 0 ? "None open" : `${openCorrections.length} open`]}
            person="This design"
          />
        ) : null}
      </div>
    </AppCard>
  );
}
