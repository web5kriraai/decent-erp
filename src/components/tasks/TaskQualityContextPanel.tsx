"use client";

import type { ReactNode } from "react";
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
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="task-quality-tile">
      <span className="task-quality-tile-label">{label}</span>
      <div className="task-quality-tile-value">{children}</div>
    </div>
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
  const machineSample = design.tasks?.find((t) => t.subProcess?.code === "MACHINE_SAMPLE");
  const matReq = design.tasks?.find((t) => t.subProcess?.code === "MAT_REQ");

  return (
    <AppCard title="Quality context" className="task-quality-context stack-section-sm">
      <div className="task-quality-grid">
        <ContextTile label="Sketch">
          <StatusBadge status={sketch?.status ?? "PENDING"} />
        </ContextTile>
        <ContextTile label="Punching">
          <StatusBadge status={punch?.status ?? "PENDING"} />
        </ContextTile>
        <ContextTile label="Machine sample">
          <StatusBadge status={machineSample?.status ?? "PENDING"} />
        </ContextTile>
        <ContextTile label="Material">
          <StatusBadge status={matReq?.status ?? "PENDING"} />
        </ContextTile>
        {canViewCorrections ? (
          <ContextTile label="My open corrections">
            <span className="task-quality-tile-count">{openCorrections.length}</span>
          </ContextTile>
        ) : null}
      </div>
      <div className="task-quality-actions">
        <AppButtonLink href={ROUTES.designs.detail(designId)} appVariant="outline" size="sm">
          Design files
        </AppButtonLink>
        {canViewCorrections && openCorrections.length > 0 ? (
          <AppButtonLink href={ROUTES.quality.corrections} appVariant="outline" size="sm">
            View my corrections
          </AppButtonLink>
        ) : null}
      </div>
    </AppCard>
  );
}
