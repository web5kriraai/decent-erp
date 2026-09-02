"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/DataTable";
import { AppCard } from "@/components/ui/AppCard";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { ROUTES } from "@/config/routes";
import { useLiveTeamTime } from "@/hooks/use-time";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";
import { apiPost } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import type { LiveTeamTimeRow } from "@/lib/types/api";

type LiveRow = LiveTeamTimeRow & Record<string, unknown>;

export function AdminTimeLiveView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);
  const canAdjust = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const liveQuery = useLiveTeamTime(enabled);
  const toast = useApiToast();

  const [adjustTarget, setAdjustTarget] = useState<{
    taskId: string;
    ideaRef: string;
    activeSeconds: number;
  } | null>(null);
  const [adjustSeconds, setAdjustSeconds] = useState("0");
  const [adjustRemark, setAdjustRemark] = useState("");

  const adjustTime = useMutation({
    mutationFn: () =>
      apiPost(`/api/tasks/${adjustTarget!.taskId}/time-adjust`, {
        remark: adjustRemark.trim(),
        adjustActiveSeconds: Number(adjustSeconds),
      }),
    onSuccess: () => {
      toast.success("Time adjusted", "Admin adjustment recorded in audit log");
      setAdjustTarget(null);
      setAdjustSeconds("0");
      setAdjustRemark("");
      liveQuery.refetch();
    },
    onError: (error) => toast.errorFromApi(error, "Could not adjust time"),
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TIME_VIEW_TEAM} />
      </div>
    );
  }

  const data = liveQuery.data;

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Live Team Time"
        subtitle="Who is working now — server-tracked timers across all employees"
        actions={
          <AppButtonLink href={ROUTES.analytics.timeReport} appVariant="secondary" size="sm">
            Time reports
          </AppButtonLink>
        }
      />

      <QueryState
        isLoading={liveQuery.isLoading}
        isError={liveQuery.isError}
        error={liveQuery.error}
        onRetry={() => liveQuery.refetch()}
        skeletonVariant="stats"
      >
        {data && (
          <>
            <div className="stat-grid stack-section">
              <StatCard label="Running now" value={data.runningCount} />
              <StatCard label="On hold" value={data.onHoldCount} />
              <StatCard label="Idle" value={data.employees.filter((e) => e.status === "IDLE").length} />
              <StatCard
                label="Last refresh"
                value={new Date(data.asOfUtc).toLocaleTimeString()}
                trend="Auto-updates every 15s"
              />
            </div>

            <AppCard contentClassName="p-0">
              <DataTable<LiveRow>
                rows={data.employees as LiveRow[]}
                getRowKey={(row) => String(row.employeeId)}
                emptyTitle="No employees on the clock"
                columns={[
                  {
                    key: "name",
                    header: "Employee",
                    render: (row) => (
                      <strong>{row.name}</strong>
                    ),
                  },
                  {
                    key: "role",
                    header: "Role",
                    render: (row) => row.role.name.replace(/_/g, " "),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <StatusBadge
                        status={row.status === "IDLE" ? "PENDING" : row.status}
                        label={row.status === "IDLE" ? "Idle" : undefined}
                      />
                    ),
                  },
                  {
                    key: "task",
                    header: "Current task",
                    render: (row) =>
                      row.task ? (
                        <>
                          <Link
                            href={ROUTES.work.taskDetail(row.task.taskId)}
                            className="data-table-link"
                          >
                            {row.task.ideaRef}
                          </Link>
                          <p className="data-table-subtext">{row.task.subProcessName}</p>
                        </>
                      ) : (
                        "-"
                      ),
                  },
                  {
                    key: "active",
                    header: "Active",
                    render: (row) =>
                      row.task ? formatDuration(row.task.activeSeconds) : "-",
                  },
                  {
                    key: "hold",
                    header: "Hold",
                    render: (row) =>
                      row.task ? formatDuration(row.task.holdSeconds) : "-",
                  },
                  {
                    key: "due",
                    header: "Due",
                    render: (row) =>
                      row.task?.dueAt
                        ? new Date(row.task.dueAt).toLocaleDateString()
                        : "-",
                  },
                  ...(canAdjust
                    ? [
                        {
                          key: "admin",
                          header: "Admin",
                          align: "right" as const,
                          render: (row: LiveRow) =>
                            row.task ? (
                              <AppButton
                                type="button"
                                appVariant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAdjustTarget({
                                    taskId: row.task!.taskId,
                                    ideaRef: row.task!.ideaRef,
                                    activeSeconds: row.task!.activeSeconds,
                                  });
                                  setAdjustSeconds("0");
                                  setAdjustRemark("");
                                }}
                              >
                                Adjust time
                              </AppButton>
                            ) : (
                              "—"
                            ),
                        },
                      ]
                    : []),
                ]}
              />
            </AppCard>
          </>
        )}
      </QueryState>

      <Modal
        open={!!adjustTarget}
        title="Admin time adjustment"
        description={
          adjustTarget
            ? `Record a manual adjustment for ${adjustTarget.ideaRef} (current active: ${formatDuration(adjustTarget.activeSeconds)})`
            : undefined
        }
        onClose={() => setAdjustTarget(null)}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={() => setAdjustTarget(null)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={!adjustRemark.trim() || adjustTime.isPending}
              onClick={() => adjustTime.mutate()}
            >
              {adjustTime.isPending ? "Saving…" : "Record adjustment"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <ModalFormGrid>
            <FormTextField
              id="adjustSeconds"
              label="Adjust active seconds"
              type="number"
              value={adjustSeconds}
              onChange={(e) => setAdjustSeconds(e.target.value)}
            />
            <FormTextField
              id="adjustRemark"
              label="Remark"
              required
              value={adjustRemark}
              onChange={(e) => setAdjustRemark(e.target.value)}
            />
          </ModalFormGrid>
        </ModalForm>
      </Modal>
    </div>
  );
}
