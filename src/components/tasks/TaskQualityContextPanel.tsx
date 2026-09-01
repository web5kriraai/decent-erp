"use client";

import Link from "next/link";
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
    <section className="card task-quality-context stack-section-sm">
      <div className="card-header">
        <span className="card-title">Quality context</span>
      </div>
      <div className="card-body" style={{ padding: "1rem 1.25rem" }}>
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
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href={ROUTES.designs.detail(designId)} className="btn btn-ghost btn-sm">
            Design files
          </Link>
          {canViewCorrections && openCorrections.length > 0 ? (
            <Link href={ROUTES.quality.corrections} className="btn btn-ghost btn-sm">
              View my corrections
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
