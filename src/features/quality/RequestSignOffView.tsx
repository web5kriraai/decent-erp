"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import { ApprovalRequestPackagePanel } from "@/components/approvals/ApprovalRequestPackagePanel";
import { PermissionDenied } from "@/components/PermissionDenied";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormTextArea } from "@/components/ui/form-text-area";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { useBreadcrumbReplacement } from "@/components/layout/BreadcrumbProvider";
import { ROUTES } from "@/config/routes";
import { useRequestDesignApproval } from "@/hooks/use-approvals";
import { useDesign } from "@/hooks/use-designs";
import { canRoleSeeReadyForSignOff } from "@/lib/approval-hub-rbac";
import { approvalsHubHrefForRole } from "@/lib/stage-approval-rbac";
import { ApiClientError } from "@/lib/api-client";
import { buildLiveApprovalPackagePreview } from "@/lib/approval-request-package";
import type { HandoffContext } from "@/lib/handoff-context";

const MIN_REMARK = 8;

type RequestSignOffViewProps = {
  designId: string;
};

export function RequestSignOffView({ designId }: RequestSignOffViewProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const roleCode = session?.user?.roleCode;
  const canRequest = canRoleSeeReadyForSignOff(roleCode);
  const readyHref = approvalsHubHrefForRole(roleCode, "ready");
  const designDetailHref = ROUTES.designs.detail(designId);

  const designQuery = useDesign(designId, canRequest && !!designId);
  const requestApproval = useRequestDesignApproval();

  const [requesterRemark, setRequesterRemark] = useState("");
  const [summaryNote, setSummaryNote] = useState("");
  const [touched, setTouched] = useState(false);

  const design = designQuery.data;
  useBreadcrumbReplacement(designId, design?.ideaRef);

  const trimmed = requesterRemark.trim();
  const remarkTooShort = trimmed.length > 0 && trimmed.length < MIN_REMARK;
  const remarkMissing = touched && trimmed.length < MIN_REMARK;

  const previewPackage = useMemo(() => {
    if (!design) return null;
    const raw = design as unknown as {
      ideaRef: string;
      collectionName: string;
      status: string;
      priority: string;
      productType?: { name?: string | null } | null;
      designHead?: { id?: number; name?: string | null } | null;
      tasks?: typeof design.tasks;
      corrections?: Array<{
        id?: string | number;
        status?: string;
        correctionType?: string | null;
        rootCause?: string | null;
      }>;
      approvals?: Array<{
        decision?: string;
        remark?: string | null;
        decisionAtUtc?: string | null;
        level?: { name?: string | null } | null;
        approver?: { name?: string | null } | null;
      }>;
      images?: Array<{ id?: string | number; fileName?: string; isPrimary?: boolean }>;
      costs?: Array<{ amount?: number | string | null }>;
    };
    return buildLiveApprovalPackagePreview({
      design: raw,
      requesterRemark: trimmed || "(Enter requester remark)",
      summaryNote: summaryNote.trim() || null,
      requesterName: raw.designHead?.name ?? "You",
      requesterEmployeeId: raw.designHead?.id,
    });
  }, [design, trimmed, summaryNote]);

  const requiresCosting = previewPackage?.snapshot.requiresCosting === true;
  const costingBlocked =
    requiresCosting && (previewPackage?.snapshot.costingEntryCount ?? 0) <= 0;
  const canSubmit =
    trimmed.length >= MIN_REMARK && !requestApproval.isPending && !costingBlocked;
  const apiError =
    requestApproval.isError && requestApproval.error instanceof ApiClientError
      ? requestApproval.error.message
      : requestApproval.isError
        ? "Could not approve design"
        : undefined;

  const handoffContext = useMemo((): HandoffContext | null => {
    if (!design) return null;
    const tasks = [...(design.tasks ?? [])].sort((a, b) => a.sequence - b.sequence);
    const completed = [...tasks]
      .reverse()
      .find((t) => ["COMPLETED", "CHECKING", "SKIPPED"].includes(t.status));
    const corrections = (design.corrections ?? []) as Array<{ status?: string }>;
    const openCorrections = corrections.filter(
      (c) => c.status && ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"].includes(c.status),
    ).length;
    const images = (design as unknown as { images?: unknown[] }).images;
    const imageCount = Array.isArray(images) ? images.length : undefined;
    const blockers: string[] = [];
    if (openCorrections > 0) {
      blockers.push("Open corrections remain");
    }
    if (costingBlocked) {
      blockers.push("Add at least one cost entry");
    }

    return {
      ideaRef: design.ideaRef,
      collectionName: design.collectionName,
      productType: design.productType?.name,
      priority: design.priority,
      stageName: "Request management approval",
      status: design.status,
      nextStepHint: costingBlocked
        ? "Complete costing first"
        : "Submit to Checker → Design Head → Management chain",
      description: undefined,
      priorStage: completed
        ? {
            code: completed.subProcess?.code,
            name: completed.subProcess?.name ?? "Prior stage",
            status: completed.status,
            outputRemark: completed.outputRemark,
            assigneeName: completed.assignedEmployee?.name,
          }
        : null,
      openCorrections: openCorrections || previewPackage?.snapshot.openCorrections || null,
      fileCount: imageCount ?? previewPackage?.snapshot.primaryFiles.length ?? null,
      blockers: blockers.length > 0 ? blockers : undefined,
    };
  }, [costingBlocked, design, previewPackage]);

  const backHref = readyHref;
  const designHref = designDetailHref;

  async function handleSubmit() {
    setTouched(true);
    if (trimmed.length < MIN_REMARK || costingBlocked) return;
    try {
      await requestApproval.mutateAsync({
        designId,
        requesterRemark: trimmed,
        summaryNote: summaryNote.trim() || undefined,
      });
      router.push(designDetailHref);
    } catch {
      // Inline apiError on the form
    }
  }

  if (!canRequest) {
    return (
      <div className="page-shell">
        <PermissionDenied message="Only Design Head can approve designs for production." />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <QueryState
        isLoading={designQuery.isLoading}
        isError={designQuery.isError}
        error={designQuery.error}
        onRetry={() => designQuery.refetch()}
        notFoundHref={backHref}
        notFoundLabel="Back to Approvals"
        skeletonVariant="stats"
      >
        {design ? (
          <>
            <PageHeader
              title={`Request management approval · ${design.ideaRef}`}
              subtitle={design.collectionName}
              actions={
                <>
                  <StatusBadge status={design.status} />
                  <PriorityBadge priority={design.priority} />
                  {design.productType?.name ? (
                    <span className="text-caption-muted">{design.productType.name}</span>
                  ) : null}
                  <AppButtonLink href={designHref} appVariant="ghost" size="sm">
                    View Design
                  </AppButtonLink>
                  <AppButtonLink href={backHref} appVariant="outline" size="sm">
                    Back to Ready
                  </AppButtonLink>
                </>
              }
            />

            <div className="stack-section">
              <AppCard
                title="Approve package"
                contentClassName="space-y-4"
              >
                <ActionHandoffBanner context={handoffContext} dense />

                {costingBlocked ? (
                  <p className="form-hint" role="status">
                    Add costing before request.{" "}
                    <AppButtonLink href={ROUTES.finance.costing} appVariant="ghost" size="sm">
                      Open Costing
                    </AppButtonLink>
                  </p>
                ) : null}

                <FormTextArea
                  id="requesterRemark"
                  label="Requester remark"
                  required
                  rows={4}
                  value={requesterRemark}
                  onChange={(e) => setRequesterRemark(e.target.value)}
                  onBlur={() => setTouched(true)}
                  onEnterSubmit={canSubmit ? () => void handleSubmit() : undefined}
                  error={
                    remarkMissing || remarkTooShort
                      ? `Minimum ${MIN_REMARK} characters`
                      : apiError
                  }
                />
                <FormTextArea
                  id="summaryNote"
                  label="Summary note"
                  rows={2}
                  value={summaryNote}
                  onChange={(e) => setSummaryNote(e.target.value)}
                  onEnterSubmit={canSubmit ? () => void handleSubmit() : undefined}
                />

                <div className="flex flex-wrap gap-2 pt-2">
                  <AppButtonLink href={backHref} appVariant="outline">
                    Cancel
                  </AppButtonLink>
                  <AppButton
                    type="button"
                    appVariant="primary"
                    disabled={!canSubmit}
                    onClick={() => void handleSubmit()}
                  >
                    {requestApproval.isPending ? "Submitting…" : "Request management approval"}
                  </AppButton>
                </div>
              </AppCard>

              <ApprovalRequestPackagePanel
                package={previewPackage}
                designId={designId}
                preview
              />
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
