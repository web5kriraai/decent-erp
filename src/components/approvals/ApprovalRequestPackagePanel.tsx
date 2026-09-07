"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconCheck,
  IconClipboardList,
  IconFileText,
  IconFolderOpen,
  IconGavel,
  IconIndianRupee,
  IconPackage,
  IconShieldAlert,
  IconUserRound,
} from "@/components/icons";
import { ROUTES } from "@/config/routes";
import {
  designFileDeepLink,
  resolveCompletedStageDetails,
  type ApprovalRequestPackage,
} from "@/lib/approval-request-package";
import { cn } from "@/lib/utils";

type ApprovalRequestPackagePanelProps = {
  package: ApprovalRequestPackage | null | undefined;
  designId: string;
  className?: string;
  /** Live preview before submit — softens links / labels. */
  preview?: boolean;
};

function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toUpperCase() : "FILE";
}

function shortStageLabel(stage: string) {
  const cleaned = stage.replace(/\s*\/\s*.*$/, "").trim();
  if (cleaned.length <= 14) return cleaned;
  return `${cleaned.slice(0, 12)}…`;
}

function formatDecision(decision: string) {
  return decision.replace(/_/g, " ").toLowerCase();
}

function SummaryItem({
  icon,
  tone,
  label,
  children,
}: {
  icon: ReactNode;
  tone: "blue" | "violet" | "rose" | "amber" | "green";
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="approval-pkg-summary-item">
      <span className={cn("approval-pkg-icon", `approval-pkg-icon--${tone}`)} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="approval-pkg-kicker">{label}</p>
        <div className="approval-pkg-value">{children}</div>
      </div>
    </div>
  );
}

export function ApprovalRequestPackagePanel({
  package: pkg,
  designId,
  className,
  preview = false,
}: ApprovalRequestPackagePanelProps) {
  if (!pkg) {
    return (
      <div className={cn("approval-pkg approval-pkg--empty", className)}>
        <p>
          {preview
            ? "Package preview loads with design data."
            : "No package stored for this design."}{" "}
          {!preview ? (
            <>
              <Link
                href={ROUTES.designs.detail(designId)}
                className="font-medium text-primary underline"
              >
                Open design
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>
    );
  }

  const snap = pkg.snapshot;
  const requestedAt = new Date(pkg.requestedAtUtc);
  const stageDetails = resolveCompletedStageDetails(snap);
  const files = snap.primaryFiles ?? [];
  const requiresCosting = snap.requiresCosting === true;
  const hasCosting = snap.costingEntryCount > 0;
  const costingLabel = hasCosting
    ? `${snap.costingEntryCount} entries`
    : requiresCosting
      ? "Required"
      : "Not required";
  const hasStageRemarks = stageDetails.some(
    (s) => (s.outputRemark && s.outputRemark.trim()) || s.assigneeName,
  );
  const briefs = snap.openCorrectionBriefs ?? [];
  const priorDecisions = snap.priorManagementDecisions ?? [];

  return (
    <section
      className={cn("approval-pkg", preview && "approval-pkg--preview", className)}
      aria-label={preview ? "Package preview" : "Requester package"}
    >
      {preview ? (
        <p className="approval-pkg-preview-badge">Preview</p>
      ) : null}

      <div className="approval-pkg-summary">
        <SummaryItem icon={<IconUserRound />} tone="blue" label="Requested by">
          <p className="m-0 truncate">{pkg.requesterName}</p>
          <time dateTime={pkg.requestedAtUtc} className="approval-pkg-metric-sub block">
            {requestedAt.toLocaleString()}
          </time>
        </SummaryItem>
        <SummaryItem icon={<IconPackage />} tone="violet" label="Product">
          <p className="m-0 truncate">{snap.productType}</p>
          <p className="approval-pkg-metric-sub m-0 truncate">{snap.collectionName}</p>
        </SummaryItem>
        <SummaryItem icon={<IconShieldAlert />} tone="rose" label="Priority">
          <span className="approval-pkg-priority" data-priority={snap.priority}>
            {snap.priority}
          </span>
        </SummaryItem>
        <SummaryItem icon={<IconClipboardList />} tone="amber" label="Idea">
          <p className="m-0 truncate">{snap.ideaRef}</p>
          <p className="approval-pkg-metric-sub m-0">
            Was {snap.statusBeforeRequest.replace(/_/g, " ").toLowerCase()}
          </p>
        </SummaryItem>
      </div>

      <div className="approval-pkg-mid">
        <div className="approval-pkg-panel">
          <p className="approval-pkg-panel-title">Requester notes</p>
          <dl className="approval-pkg-remarks">
            <div>
              <dt>Remark</dt>
              <dd>{pkg.requesterRemark}</dd>
            </div>
            {pkg.summaryNote ? (
              <div>
                <dt>Summary note</dt>
                <dd>{pkg.summaryNote}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="approval-pkg-panel">
          <p className="approval-pkg-panel-title">
            Workflow progress · {stageDetails.length} done
          </p>
          {stageDetails.length > 0 ? (
            <>
              <ol className="approval-pkg-stepper">
                {stageDetails.map((stage, index) => (
                  <li
                    key={`${stage.code ?? stage.name}-${index}`}
                    className="approval-pkg-step approval-pkg-step--done"
                    title={
                      stage.outputRemark
                        ? `${stage.name}: ${stage.outputRemark}`
                        : stage.name
                    }
                  >
                    <span className="approval-pkg-step-mark" aria-hidden>
                      <IconCheck />
                    </span>
                    <span className="approval-pkg-step-label">
                      {shortStageLabel(stage.name)}
                    </span>
                  </li>
                ))}
                <li
                  className="approval-pkg-step approval-pkg-step--current"
                  title="Management approval"
                >
                  <span className="approval-pkg-step-mark" aria-hidden>
                    {stageDetails.length + 1}
                  </span>
                  <span className="approval-pkg-step-label">Management</span>
                </li>
              </ol>

              {hasStageRemarks ? (
                <ol className="approval-pkg-stage-remarks">
                  {stageDetails.map((stage, index) => (
                    <li key={`remark-${stage.code ?? stage.name}-${index}`}>
                      <div className="approval-pkg-stage-remark-head">
                        <span className="approval-pkg-stage-remark-name">{stage.name}</span>
                        {stage.assigneeName ? (
                          <span className="approval-pkg-stage-remark-assignee">
                            {stage.assigneeName}
                          </span>
                        ) : null}
                      </div>
                      {stage.outputRemark?.trim() ? (
                        <p className="approval-pkg-stage-remark-body">{stage.outputRemark}</p>
                      ) : (
                        <p className="approval-pkg-metric-sub m-0">No output remark</p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          ) : (
            <p className="approval-pkg-metric-sub m-0">
              No completed stages recorded in package.
            </p>
          )}
        </div>
      </div>

      {briefs.length > 0 ? (
        <div className="approval-pkg-panel approval-pkg-panel--full">
          <p className="approval-pkg-panel-title">
            Open correction briefs · {briefs.length}
          </p>
          <ul className="approval-pkg-brief-list">
            {briefs.map((brief) => (
              <li key={brief.id}>
                <span className="approval-pkg-brief-type">
                  {brief.type?.replace(/_/g, " ") ?? "Correction"}
                </span>
                <p className="approval-pkg-brief-body">
                  {brief.rootCause?.trim() || "No root cause recorded."}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {priorDecisions.length > 0 ? (
        <div className="approval-pkg-panel approval-pkg-panel--full">
          <p className="approval-pkg-panel-title">
            <IconGavel className="approval-pkg-panel-title-icon" aria-hidden />
            Prior management decisions · {priorDecisions.length}
          </p>
          <ul className="approval-pkg-decision-list">
            {priorDecisions.map((d, index) => (
              <li key={`${d.levelName}-${d.decision}-${index}`}>
                <div className="approval-pkg-decision-head">
                  <span className="approval-pkg-decision-level">{d.levelName}</span>
                  <span
                    className="approval-pkg-decision-badge"
                    data-decision={d.decision}
                  >
                    {formatDecision(d.decision)}
                  </span>
                </div>
                {d.remark?.trim() ? (
                  <p className="approval-pkg-decision-remark">{d.remark}</p>
                ) : null}
                <p className="approval-pkg-metric-sub m-0">
                  {[d.decidedBy, d.decidedAt ? new Date(d.decidedAt).toLocaleString() : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="approval-pkg-metrics">
        <div className="approval-pkg-metric">
          <span className="approval-pkg-icon approval-pkg-icon--green" aria-hidden>
            <IconIndianRupee />
          </span>
          <div className="min-w-0">
            <p className="approval-pkg-kicker">Costing</p>
            <p className="approval-pkg-metric-value">
              {hasCosting ? `₹${snap.costingTotal.toLocaleString()}` : "—"}
            </p>
            <p className="approval-pkg-metric-sub">
              {costingLabel}
            </p>
            {!preview ? (
              <Link href={ROUTES.finance.costing} className="approval-pkg-metric-link">
                Open costing
              </Link>
            ) : null}
          </div>
        </div>

        <div className="approval-pkg-metric">
          <span className="approval-pkg-icon approval-pkg-icon--amber" aria-hidden>
            <IconAlertTriangle />
          </span>
          <div className="min-w-0">
            <p className="approval-pkg-kicker">Open corrections</p>
            <p className="approval-pkg-metric-value">{snap.openCorrections}</p>
            <p className="approval-pkg-metric-sub">
              {snap.openCorrections === 0 ? "None blocking" : "Review before approve"}
            </p>
            {!preview ? (
              <Link href={ROUTES.quality.corrections} className="approval-pkg-metric-link">
                Open corrections
              </Link>
            ) : null}
          </div>
        </div>

        <div className="approval-pkg-metric">
          <span className="approval-pkg-icon approval-pkg-icon--blue" aria-hidden>
            <IconFolderOpen />
          </span>
          <div className="min-w-0">
            <p className="approval-pkg-kicker">Design access</p>
            <p className="approval-pkg-metric-value">{files.length}</p>
            <p className="approval-pkg-metric-sub">Attached files in package</p>
            {!preview ? (
              <Link href={ROUTES.designs.detail(designId)} className="approval-pkg-metric-link">
                Open design
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {!preview ? (
        <div className="approval-pkg-resources">
          <p className="approval-pkg-panel-title">Quick links</p>
          <div className="approval-pkg-resource-row">
            <Link href={ROUTES.designs.detail(designId)} className="approval-pkg-resource-btn">
              <IconPackage aria-hidden />
              Design
            </Link>
            <Link href={designFileDeepLink(designId)} className="approval-pkg-resource-btn">
              <IconFolderOpen aria-hidden />
              Files
            </Link>
            <Link href={ROUTES.finance.costing} className="approval-pkg-resource-btn">
              <IconIndianRupee aria-hidden />
              Costing
            </Link>
            <Link href={ROUTES.quality.corrections} className="approval-pkg-resource-btn">
              <IconAlertTriangle aria-hidden />
              Corrections
            </Link>
          </div>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="approval-pkg-attachments">
          <p className="approval-pkg-panel-title">Attached files · {files.length}</p>
          <ul className="approval-pkg-file-cards">
            {files.map((f) => (
              <li key={f.id}>
                {preview ? (
                  <span className="approval-pkg-file-card" title={f.fileName}>
                    <span className="approval-pkg-file-icon" aria-hidden>
                      <IconFileText />
                    </span>
                    <span className="approval-pkg-file-meta">
                      <span className="approval-pkg-file-name">{f.fileName}</span>
                      <span className="approval-pkg-file-ext">
                        {fileExt(f.fileName)}
                        {f.isPrimary ? " · Primary" : ""}
                      </span>
                    </span>
                  </span>
                ) : (
                  <Link
                    href={designFileDeepLink(designId, f.id)}
                    className="approval-pkg-file-card"
                    title={f.fileName}
                  >
                    <span className="approval-pkg-file-icon" aria-hidden>
                      <IconFileText />
                    </span>
                    <span className="approval-pkg-file-meta">
                      <span className="approval-pkg-file-name">{f.fileName}</span>
                      <span className="approval-pkg-file-ext">
                        {fileExt(f.fileName)}
                        {f.isPrimary ? " · Primary" : ""}
                      </span>
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
