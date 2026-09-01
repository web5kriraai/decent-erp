"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ROUTES } from "@/config/routes";
import type { DesignSummary } from "@/lib/types/api";

type TaskQualityContextProps = {
  designId: string;
  subProcessCode?: string;
};

export function TaskQualityContextPanel({ designId, subProcessCode }: TaskQualityContextProps) {
  const isQualityStage = subProcessCode === "SAMPLE_CHECK" || subProcessCode === "PUNCH_CHECK";
  const designQuery = useQuery({
    queryKey: queryKeys.designs.detail(designId),
    queryFn: () => apiGet<DesignSummary>(`/api/designs/${designId}`),
    enabled: isQualityStage && !!designId,
  });

  if (!isQualityStage || !designQuery.data) return null;

  const design = designQuery.data;
  const openCorrections = ((design.corrections ?? []) as Array<{ status: string }>).filter(
    (c) => c.status === "OPEN",
  );
  const sketch = design.tasks?.find((t) => t.subProcess?.code === "SKETCH");
  const punch = design.tasks?.find((t) => t.subProcess?.code === "PUNCH");
  const machineSample = design.tasks?.find((t) => t.subProcess?.code === "MACHINE_SAMPLE");
  const matReq = design.tasks?.find((t) => t.subProcess?.code === "MAT_REQ");

  return (
    <section className="card task-quality-context" style={{ marginBottom: "1rem" }}>
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
          <dt>Open corrections</dt>
          <dd>{openCorrections.length}</dd>
        </dl>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href={ROUTES.designs.detail(designId)} className="btn btn-ghost btn-sm">
            Design files
          </Link>
          {openCorrections.length > 0 ? (
            <Link href={ROUTES.quality.corrections} className="btn btn-ghost btn-sm">
              View corrections
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
