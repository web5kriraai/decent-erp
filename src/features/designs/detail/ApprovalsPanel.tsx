"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { useSubmitApproval } from "@/hooks/use-approvals";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignSummary } from "@/lib/types/api";

function statusBadge(decision: string) {
  const approved = decision === "APPROVED" || decision === "COMPLETED";
  const pending = decision === "PENDING" || decision === "ASSIGNED" || decision === "CHECKING";
  const className = approved
    ? "bg-emerald-50 text-emerald-700"
    : pending
      ? "bg-amber-50 text-amber-800"
      : "bg-muted text-muted-foreground";
  const label = approved ? "Approved" : pending ? "Pending" : decision.replaceAll("_", " ");
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  );
}

export function ApprovalsPanel({ design }: { design: DesignSummary }) {
  const { data: session } = useSession();
  const submit = useSubmitApproval();
  const canApprove = (session?.user?.permissions ?? []).includes(PERMISSIONS.DESIGN_APPROVE);

  const stageRows = useMemo(() => {
    return (design.tasks ?? [])
      .filter((t) => t.subProcess?.isApproval)
      .sort((a, b) => a.sequence - b.sequence)
      .map((t) => ({
        id: t.id,
        name: t.subProcess?.name ?? t.process?.name ?? `Step ${t.sequence}`,
        decision: t.status === "COMPLETED" ? "APPROVED" : t.status,
        kind: "stage" as const,
      }));
  }, [design.tasks]);

  const managementRows = useMemo(() => {
    return [...(design.approvals ?? [])]
      .sort((a, b) => (a.level?.sequence ?? 0) - (b.level?.sequence ?? 0))
      .map((a) => ({
        id: a.id,
        name: a.level?.name ?? "Approval",
        decision: a.decision,
        levelId: a.level?.id,
        kind: "management" as const,
      }));
  }, [design.approvals]);

  const rows = [...stageRows, ...managementRows];
  const pendingManagement = managementRows.find((r) => r.decision === "PENDING");

  async function approveCurrent() {
    if (!pendingManagement?.levelId) return;
    await submit.mutateAsync({
      designId: design.id,
      approvalLevelId: pendingManagement.levelId,
      decision: "APPROVED",
    });
  }

  return (
    <div className="space-y-4">
      <AppCard title="Approval Flow">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approval steps for this design yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {rows.map((row, index) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-5 font-medium text-muted-foreground">{index + 1}.</span>
                <span className="min-w-[10rem] font-medium text-foreground">{row.name}</span>
                {statusBadge(row.decision)}
              </li>
            ))}
          </ol>
        )}
      </AppCard>
      {canApprove && pendingManagement ? (
        <AppButton
          type="button"
          appVariant="primary"
          size="sm"
          disabled={submit.isPending}
          onClick={() => void approveCurrent()}
        >
          {submit.isPending ? "Approving…" : "Approve Current Level"}
        </AppButton>
      ) : null}
    </div>
  );
}
