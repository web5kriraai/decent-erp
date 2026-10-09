"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { RightDrawer } from "@/components/ui/RightDrawer";
import { AppButton } from "@/components/ui/AppButton";
import { QueryState } from "@/components/ui/QueryState";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDesign } from "@/hooks/use-designs";
import { AssignTaskModal } from "@/features/designs/AssignTaskModal";
import { DesignEditModal } from "@/features/designs/DesignEditModal";
import { WorkflowOverrideActions } from "@/features/designs/WorkflowOverrideActions";
import { OverviewPanel } from "@/features/designs/detail/OverviewPanel";
import { CorrectionsPanel } from "@/features/designs/detail/CorrectionsPanel";
import { CostingPanel } from "@/features/designs/detail/CostingPanel";
import { DesignBomPanel } from "@/features/designs/detail/DesignBomPanel";
import { KraKpiPanel } from "@/features/designs/detail/KraKpiPanel";
import { FilesPanel } from "@/features/designs/detail/FilesPanel";
import { ApprovalsPanel } from "@/features/designs/detail/ApprovalsPanel";
import { ActivityTimelinePanel } from "@/features/designs/detail/ActivityTimelinePanel";
import { hasWorkflowHistoryPermission } from "@/lib/permissions";
import type { DesignDetailTab } from "@/features/designs/DesignDetailModalProvider";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask } from "@/lib/types/api";
import { cn } from "@/lib/utils";

const TAB_ITEMS: { value: DesignDetailTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity" },
  { value: "corrections", label: "Corrections" },
  { value: "costing", label: "Costing" },
  { value: "kra-kpi", label: "KRA/KPI" },
  { value: "files", label: "Files" },
  { value: "approvals", label: "Approvals" },
];

function formatDue(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DesignDetailTabsBody({
  designId,
  tab,
  onTabChange,
  compactHero = false,
  layout = "panel",
}: {
  designId: string;
  tab: DesignDetailTab;
  onTabChange: (tab: DesignDetailTab) => void;
  compactHero?: boolean;
  /** Full design page: current task is stated once, then each tab is only its own content. */
  layout?: "page" | "panel";
}) {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const designQuery = useDesign(designId, true);
  const [assignTask, setAssignTask] = useState<DesignTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);

  const canAssign =
    permissions.includes(PERMISSIONS.DESIGN_ASSIGN) ||
    permissions.includes(PERMISSIONS.DESIGN_ASSIGN_MANUAL) ||
    permissions.includes(PERMISSIONS.DESIGN_ASSIGN_AUTO);
  const canEdit = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const canRaise =
    permissions.includes(PERMISSIONS.CORRECTION_RAISE) ||
    permissions.includes(PERMISSIONS.CORRECTION_REQUEST);
  const canViewHistory = hasWorkflowHistoryPermission(permissions);
  const visibleTabs = useMemo(
    () =>
      TAB_ITEMS.filter((item) => item.value !== "activity" || canViewHistory),
    [canViewHistory],
  );
  const canOverride = permissions.includes(PERMISSIONS.WORKFLOW_OVERRIDE);
  const canUpload = permissions.includes(PERMISSIONS.DESIGN_CREATE);

  const design = designQuery.data;
  const pageLayout = layout === "page";
  const primaryImage = design?.images?.find((i) => i.isPrimary) ?? design?.images?.[0];
  const progress = design?.detailMeta?.progressPercent ?? 0;
  const owner = design?.detailMeta?.currentOwner?.name ?? "-";
  const due = formatDue(design?.detailMeta?.dueAt ?? null);
  const assignableTask = useMemo(() => {
    return (
      design?.tasks?.find((t) =>
        ["PENDING", "ASSIGNED", "CORRECTION_REQUIRED", "RUNNING", "CHECKING"].includes(
          t.status,
        ),
      ) ??
      design?.tasks?.[0] ??
      null
    );
  }, [design?.tasks]);

  const currentStage =
    assignableTask?.subProcess?.name ?? design?.currentStage ?? "This design";
  const currentHolder = assignableTask?.assignedEmployee?.name ?? owner;

  useEffect(() => {
    if (tab !== "corrections") setCorrectionOpen(false);
  }, [tab]);

  return (
    <QueryState
      isLoading={designQuery.isLoading}
      isError={designQuery.isError}
      error={designQuery.error}
      onRetry={() => designQuery.refetch()}
      skeletonVariant="stats"
    >
      {design ? (
        <div className="space-y-4">
          {pageLayout ? (
            <p className="design-detail-current">
              Current task is <strong>{currentStage}</strong>
              {currentHolder && currentHolder !== "-" ? (
                <>
                  {" "}
                  with <strong>{currentHolder}</strong>
                </>
              ) : null}
              {due !== "-" ? (
                <>
                  {" "}
                  · due {due}
                </>
              ) : null}
            </p>
          ) : (
          <div
            className={cn(
              "grid gap-3",
              compactHero ? "grid-cols-1" : "sm:grid-cols-[7rem_1fr]",
            )}
          >
            {!compactHero ? (
              <div className="flex size-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
                {primaryImage?.downloadUrl &&
                (!primaryImage.mediaKind || primaryImage.mediaKind === "IMAGE") ? (
                  <button
                    type="button"
                    className="workflow-dash-card__img-btn size-full"
                    title="View full image"
                    aria-label={`View image for ${design.ideaRef}`}
                    onClick={() => setImageLightboxOpen(true)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={primaryImage.downloadUrl}
                      alt={primaryImage.fileName ?? design.collectionName}
                      className="size-full object-contain"
                    />
                  </button>
                ) : (
                  (primaryImage?.fileName ?? "No image")
                )}
              </div>
            ) : null}
            <div className="min-w-0 space-y-2">
              {!compactHero ? (
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {design.collectionName}
                  </h2>
                  <p className="text-sm text-muted-foreground">{design.ideaRef}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {design.productType?.name ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    {design.productType.name}
                  </span>
                ) : null}
                {design.currentStage ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    {design.currentStage}
                  </span>
                ) : null}
                {design.season?.name ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    {design.season.name}
                  </span>
                ) : null}
              </div>
              <dl
                className={cn(
                  "grid gap-1 text-sm",
                  compactHero ? "grid-cols-2" : "sm:grid-cols-3",
                )}
              >
                {!compactHero ? (
                  <div>
                    <dt className="text-muted-foreground">Design Head</dt>
                    <dd className="font-medium">{design.designHead?.name ?? "-"}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">Current Owner</dt>
                  <dd className="font-medium">{owner}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Due</dt>
                  <dd className="font-medium">{due}</dd>
                </div>
              </dl>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {canAssign && assignableTask ? (
                  <AppButton
                    type="button"
                    appVariant="primary"
                    size="sm"
                    onClick={() =>
                      setAssignTask({
                        ...assignableTask,
                        design: {
                          id: design.id,
                          ideaRef: design.ideaRef,
                          collectionName: design.collectionName,
                          priority: design.priority,
                        },
                      } as DesignTask)
                    }
                  >
                    Assign Task
                  </AppButton>
                ) : null}
                {canOverride ? (
                  <WorkflowOverrideActions
                    designId={design.id}
                    design={design}
                    presentation={compactHero ? "inline" : "modal"}
                  />
                ) : null}
              </div>
            </div>
          </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => onTabChange(v as DesignDetailTab)}
          >
            <TabsList
              variant="line"
              className="design-detail-tablist"
            >
              {visibleTabs.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview" className="pt-3">
              <OverviewPanel
                design={design}
                canEdit={canEdit}
                onEditComponents={() => setEditOpen(true)}
              />
            </TabsContent>
            {canViewHistory ? (
              <TabsContent value="activity" className="pt-3">
                <ActivityTimelinePanel designId={String(design.id)} />
              </TabsContent>
            ) : null}
            <TabsContent value="corrections" className="pt-3">
              <CorrectionsPanel
                design={design}
                corrections={design.corrections ?? []}
                canRaise={canRaise}
                raiseOpen={correctionOpen}
                onRaiseOpenChange={setCorrectionOpen}
                defaultTaskId={assignableTask?.id}
              />
            </TabsContent>
            <TabsContent value="costing" className="pt-3 space-y-6">
              <CostingPanel design={design} />
              <DesignBomPanel designId={String(design.id)} />
            </TabsContent>
            <TabsContent value="kra-kpi" className="pt-3">
              <KraKpiPanel design={design} />
            </TabsContent>
            <TabsContent value="files" className="pt-3">
              <FilesPanel design={design} canUpload={canUpload} />
            </TabsContent>
            <TabsContent value="approvals" className="pt-3">
              <ApprovalsPanel design={design} />
            </TabsContent>
          </Tabs>

          {assignTask ? (
            <AssignTaskModal
              open={!!assignTask}
              onClose={() => setAssignTask(null)}
              task={assignTask}
            />
          ) : null}
          {editOpen ? (
            <DesignEditModal
              open={editOpen}
              onClose={() => setEditOpen(false)}
              design={design}
            />
          ) : null}
          <ImageLightboxModal
            open={imageLightboxOpen}
            onClose={() => setImageLightboxOpen(false)}
            imageUrl={primaryImage?.downloadUrl}
            title={design.ideaRef}
            description={design.collectionName}
          />
        </div>
      ) : null}
    </QueryState>
  );
}

export function DesignDetailModal({
  designId,
  open,
  onClose,
  tab,
  onTabChange,
}: {
  designId: string;
  open: boolean;
  onClose: () => void;
  tab: DesignDetailTab;
  onTabChange: (tab: DesignDetailTab) => void;
}) {
  const designQuery = useDesign(designId, open);
  const title = designQuery.data?.collectionName ?? "Design detail";
  const description = designQuery.data?.ideaRef;

  return (
    <RightDrawer open={open} title={title} description={description} onClose={onClose}>
      <DesignDetailTabsBody
        designId={designId}
        tab={tab}
        onTabChange={onTabChange}
        compactHero
      />
    </RightDrawer>
  );
}
