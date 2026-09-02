"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import { ProductionReturnModal } from "@/features/production/ProductionReturnModal";
import { useAcceptProductionHandoff } from "@/hooks/use-production";
import { useProductionInbox } from "@/hooks/use-workbench";
import { useMyTasks } from "@/hooks/use-tasks";
import { isDashboardOpenTask } from "@/lib/task-list-filters";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchQuickActions,
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";
import type { ProductionInboxDesign } from "@/lib/services/production-inbox-service";

function InboxList({
  items,
  emptyMessage,
  taskLink,
  onReturn,
  onAccept,
  acceptingDesignId,
}: {
  items: ProductionInboxDesign[];
  emptyMessage: string;
  taskLink?: (item: ProductionInboxDesign) => string | undefined;
  onReturn?: (item: ProductionInboxDesign) => void;
  onAccept?: (item: ProductionInboxDesign) => void;
  acceptingDesignId?: string | null;
}) {
  if (items.length === 0) {
    return <WorkbenchEmpty message={emptyMessage} />;
  }
  return (
    <ul className="detail-task-list">
      {items.slice(0, 6).map((item) => {
        const taskHref = taskLink?.(item);
        return (
          <WorkbenchListItem
            key={item.designId}
            primaryHref={taskHref ?? ROUTES.designs.detail(item.designId)}
            primaryLabel={item.ideaRef}
            meta={`${item.productType} · ${item.collectionName}`}
            detail={
              taskHref
                ? `${item.stageLabel} — open on My Tasks`
                : `${item.stageLabel} · Design Head: ${item.designHead}`
            }
            trailing={<StatusBadge status={item.status} />}
            action={
              <div className="workbench-list-actions">
                {onAccept && item.needsAcceptance ? (
                  <AppButton
                    type="button"
                    appVariant="primary"
                    size="xs"
                    className="workbench-list-action"
                    disabled={acceptingDesignId === item.designId}
                    onClick={() => onAccept(item)}
                  >
                    Accept
                  </AppButton>
                ) : null}
                {onReturn ? (
                  <AppButton
                    type="button"
                    appVariant="outline"
                    size="xs"
                    className="workbench-list-action"
                    onClick={() => onReturn(item)}
                  >
                    Return
                  </AppButton>
                ) : null}
              </div>
            }
          />
        );
      })}
    </ul>
  );
}

export function ProductionHeadDashboard() {
  const { data: session } = useSession();
  const inboxQuery = useProductionInbox(true);
  const tasksQuery = useMyTasks(true);
  const acceptHandoff = useAcceptProductionHandoff();
  const [returnDesign, setReturnDesign] = useState<ProductionInboxDesign | null>(null);
  const [acceptingDesignId, setAcceptingDesignId] = useState<string | null>(null);

  const inbox = inboxQuery.data;
  const openTasks = (tasksQuery.data ?? []).filter(isDashboardOpenTask);
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const counts = inbox?.counts;

  async function handleAccept(item: ProductionInboxDesign) {
    setAcceptingDesignId(item.designId);
    try {
      await acceptHandoff.mutateAsync(item.designId);
    } finally {
      setAcceptingDesignId(null);
    }
  }

  return (
    <WorkbenchShell
      firstName={firstName}
      title="Production desk"
      subtitle="Handoff acceptance, production instruction, and release workflow"
      actions={
        <AppButtonLink href={ROUTES.work.tasks} appVariant="primary" size="sm">
          My Action Center
        </AppButtonLink>
      }
      isLoading={inboxQuery.isLoading || tasksQuery.isLoading}
      isError={inboxQuery.isError || tasksQuery.isError}
      error={inboxQuery.error ?? tasksQuery.error}
      onRetry={() => {
        inboxQuery.refetch();
        tasksQuery.refetch();
      }}
    >
      <div className="workbench-overview">
        <WorkbenchQuickActions
          actions={[
            {
              href: ROUTES.work.tasks,
              label: "My Tasks",
              badge: openTasks.length,
            },
            { href: ROUTES.production.release, label: "Production desk" },
            { href: ROUTES.finance.costing, label: "Costing" },
          ]}
        />
        <div className="stat-grid workbench-pulse">
          <StatCard
            label="Ready for acceptance"
            value={counts?.ready_for_acceptance ?? 0}
          />
          <StatCard label="Instruction in progress" value={counts?.instruction_pending ?? 0} />
          <StatCard label="Ready for release" value={counts?.ready_for_release ?? 0} />
          <StatCard label="Returned / clarification" value={counts?.returned_clarification ?? 0} />
          <StatCard label="Released" value={counts?.released ?? 0} />
          <StatCard label="Handoff with Design Head" value={counts?.handoff_pending ?? 0} />
        </div>
      </div>

      <section className="workbench-queues" aria-label="Production inbox">
        <h2 className="workbench-section-title">Production handoff inbox</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="Ready for acceptance"
            href={ROUTES.work.tasks}
            linkLabel="My tasks"
            emptyMessage="No designs waiting for production acceptance."
          >
            <InboxList
              items={inbox?.readyForAcceptance ?? []}
              emptyMessage="When Design Head completes handoff, accept production here to unlock instruction."
              taskLink={(item) =>
                !item.needsAcceptance && item.instructionTaskId
                  ? ROUTES.work.taskDetail(item.instructionTaskId)
                  : undefined
              }
              onAccept={handleAccept}
              acceptingDesignId={acceptingDesignId}
              onReturn={(item) => setReturnDesign(item)}
            />
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Returned / clarification"
            href={ROUTES.production.release}
            linkLabel="Production release"
            emptyMessage="No designs returned for clarification."
          >
            <InboxList
              items={inbox?.returnedClarification ?? []}
              emptyMessage="Production returns you initiated appear here until design closes them."
              taskLink={(item) => ROUTES.designs.detail(item.designId)}
            />
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Production instruction pending"
            href={ROUTES.work.tasks}
            linkLabel="My tasks"
            emptyMessage="No instructions in progress."
          >
            <InboxList
              items={inbox?.instructionPending ?? []}
              emptyMessage="Active production instruction work shows here while in progress."
              taskLink={(item) =>
                item.instructionTaskId ? ROUTES.work.taskDetail(item.instructionTaskId) : undefined
              }
              onReturn={(item) => setReturnDesign(item)}
            />
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Ready for release"
            href={ROUTES.work.tasks}
            linkLabel="Complete release"
            emptyMessage="No designs ready for production release."
          >
            <InboxList
              items={inbox?.readyForRelease ?? []}
              emptyMessage="After instruction is complete, release the design on My Tasks."
              taskLink={(item) =>
                item.releaseTaskId ? ROUTES.work.taskDetail(item.releaseTaskId) : undefined
              }
            />
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Waiting on Design Head"
            href={ROUTES.production.release}
            linkLabel="Production desk"
            emptyMessage="All approved designs have been handed off."
          >
            <InboxList
              items={inbox?.handoffPending ?? []}
              emptyMessage="Design Head must complete production handoff after management approval."
            />
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Released to production"
            href={ROUTES.production.release}
            linkLabel="ERP handoffs"
            emptyMessage="No released designs yet."
          >
            <InboxList
              items={inbox?.released ?? []}
              emptyMessage="Released designs and ERP sync status appear on the production desk."
            />
          </WorkbenchQueueCard>
        </div>
      </section>

      {returnDesign ? (
        <ProductionReturnModal
          open
          designId={returnDesign.designId}
          ideaRef={returnDesign.ideaRef}
          onClose={() => setReturnDesign(null)}
        />
      ) : null}
    </WorkbenchShell>
  );
}
