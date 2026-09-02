"use client";

import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
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
  const machineSample = design.tasks?.find((t) => t.subProcess?.code === "MACHINE_SAMPLE");
  const matReq = design.tasks?.find((t) => t.subProcess?.code === "MAT_REQ");

  return (
    <AppCard title="Quality context" className="task-quality-context stack-section-sm">
      <dl className="workflow-context-grid">
        <dt>Sketch</dt>
        <dd>{sketch?.status.replace(/_/g, " ") ?? "—"}</dd>
        <dt>Punching</dt>
        <dd>{punch?.status.replace(/_/g, " ") ?? "—"}</dd>
        <dt>Machine sample</dt>
        <dd>{machineSample?.status.replace(/_/g, " ") ?? "—"}</dd>
        <dt>Material</dt>
        <dd>{matReq?.status.replace(/_/g, " ") ?? "—"}</dd>
        {canViewCorrections ? (
          <>
            <dt>My open corrections</dt>
            <dd>{openCorrections.length}</dd>
          </>
        ) : null}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <AppButtonLink href={ROUTES.designs.detail(designId)} appVariant="ghost" size="sm">
          Design files
        </AppButtonLink>
        {canViewCorrections && openCorrections.length > 0 ? (
          <AppButtonLink href={ROUTES.quality.corrections} appVariant="ghost" size="sm">
            View my corrections
          </AppButtonLink>
        ) : null}
      </div>
    </AppCard>
  );
}
