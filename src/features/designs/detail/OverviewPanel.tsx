"use client";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import type { DesignSummary } from "@/lib/types/api";

export function OverviewPanel({
  design,
  onEditComponents,
  canEdit,
}: {
  design: DesignSummary;
  onEditComponents?: () => void;
  canEdit?: boolean;
}) {
  const stage =
    design.currentStage ??
    design.tasks?.find((t) =>
      ["RUNNING", "ASSIGNED", "CHECKING"].includes(t.status),
    )?.subProcess?.name ??
    design.status;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AppCard title="Concept Information">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Product</dt>
            <dd className="font-medium">{design.productType?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Season</dt>
            <dd className="font-medium">{design.season?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Priority</dt>
            <dd className="font-medium">{design.priority}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Stage</dt>
            <dd className="font-medium">{stage}</dd>
          </div>
        </dl>
      </AppCard>
      <AppCard title="Components">
        <div className="flex flex-wrap gap-2">
          {(design.components ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No components yet.</p>
          ) : (
            (design.components ?? []).map((c) => (
              <span
                key={c.id}
                className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-sm font-medium"
              >
                {c.componentType?.name ?? "Component"}
              </span>
            ))
          )}
        </div>
        {canEdit && onEditComponents ? (
          <AppButton
            type="button"
            appVariant="outline"
            size="sm"
            className="mt-4"
            onClick={onEditComponents}
          >
            Edit Components
          </AppButton>
        ) : null}
      </AppCard>
    </div>
  );
}
