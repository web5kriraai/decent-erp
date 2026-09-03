"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderOpenIcon,
  IndianRupeeIcon,
  PackageIcon,
  ShieldAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { ROUTES } from "@/config/routes";
import {
  designFileDeepLink,
  type ApprovalRequestPackage,
} from "@/lib/approval-request-package";
import { cn } from "@/lib/utils";

type ApprovalRequestPackagePanelProps = {
  package: ApprovalRequestPackage | null | undefined;
  designId: string;
  className?: string;
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
}: ApprovalRequestPackagePanelProps) {
  if (!pkg) {
    return (
      <div className={cn("approval-pkg approval-pkg--empty", className)}>
        <p>
          No requester package was stored for this design (legacy request).{" "}
          <Link href={ROUTES.designs.detail(designId)} className="font-medium text-primary underline">
            Open design
          </Link>{" "}
          to review files, costing, and workflow.
        </p>
      </div>
    );
  }

  const snap = pkg.snapshot;
  const requestedAt = new Date(pkg.requestedAtUtc);
  const stages = snap.completedStages ?? [];
  const files = snap.primaryFiles ?? [];
  const hasCosting = snap.costingEntryCount > 0;

  return (
    <section className={cn("approval-pkg", className)} aria-label="Requester package">
      <div className="approval-pkg-summary">
        <SummaryItem icon={<UserRoundIcon />} tone="blue" label="Requested by">
          <p className="m-0 truncate">{pkg.requesterName}</p>
          <time dateTime={pkg.requestedAtUtc} className="approval-pkg-metric-sub block">
            {requestedAt.toLocaleString()}
          </time>
        </SummaryItem>
        <SummaryItem icon={<PackageIcon />} tone="violet" label="Product">
          <p className="m-0 truncate">{snap.productType}</p>
          <p className="approval-pkg-metric-sub m-0 truncate">{snap.collectionName}</p>
        </SummaryItem>
        <SummaryItem icon={<ShieldAlertIcon />} tone="rose" label="Priority">
          <span className="approval-pkg-priority" data-priority={snap.priority}>
            {snap.priority}
          </span>
        </SummaryItem>
        <SummaryItem icon={<ClipboardListIcon />} tone="amber" label="Idea">
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
            Workflow progress · {stages.length} done
          </p>
          {stages.length > 0 ? (
            <ol className="approval-pkg-stepper">
              {stages.map((stage, index) => (
                <li
                  key={`${stage}-${index}`}
                  className="approval-pkg-step approval-pkg-step--done"
                  title={stage}
                >
                  <span className="approval-pkg-step-mark" aria-hidden>
                    <CheckIcon />
                  </span>
                  <span className="approval-pkg-step-label">{shortStageLabel(stage)}</span>
                </li>
              ))}
              <li className="approval-pkg-step approval-pkg-step--current" title="Management approval">
                <span className="approval-pkg-step-mark" aria-hidden>
                  {stages.length + 1}
                </span>
                <span className="approval-pkg-step-label">Management</span>
              </li>
            </ol>
          ) : (
            <p className="approval-pkg-metric-sub m-0">No completed stages recorded in package.</p>
          )}
        </div>
      </div>

      <div className="approval-pkg-metrics">
        <div className="approval-pkg-metric">
          <span className="approval-pkg-icon approval-pkg-icon--green" aria-hidden>
            <IndianRupeeIcon />
          </span>
          <div className="min-w-0">
            <p className="approval-pkg-kicker">Costing</p>
            <p className="approval-pkg-metric-value">
              {hasCosting ? `₹${snap.costingTotal.toLocaleString()}` : "—"}
            </p>
            <p className="approval-pkg-metric-sub">
              {hasCosting ? `${snap.costingEntryCount} entries` : "No entries yet"}
            </p>
            <Link href={ROUTES.finance.costing} className="approval-pkg-metric-link">
              Open costing
            </Link>
          </div>
        </div>

        <div className="approval-pkg-metric">
          <span className="approval-pkg-icon approval-pkg-icon--amber" aria-hidden>
            <AlertTriangleIcon />
          </span>
          <div className="min-w-0">
            <p className="approval-pkg-kicker">Open corrections</p>
            <p className="approval-pkg-metric-value">{snap.openCorrections}</p>
            <p className="approval-pkg-metric-sub">
              {snap.openCorrections === 0 ? "None blocking" : "Review before approve"}
            </p>
            <Link href={ROUTES.quality.corrections} className="approval-pkg-metric-link">
              Open corrections
            </Link>
          </div>
        </div>

        <div className="approval-pkg-metric">
          <span className="approval-pkg-icon approval-pkg-icon--blue" aria-hidden>
            <FolderOpenIcon />
          </span>
          <div className="min-w-0">
            <p className="approval-pkg-kicker">Design access</p>
            <p className="approval-pkg-metric-value">{files.length}</p>
            <p className="approval-pkg-metric-sub">Attached files in package</p>
            <Link href={ROUTES.designs.detail(designId)} className="approval-pkg-metric-link">
              Open design
            </Link>
          </div>
        </div>
      </div>

      <div className="approval-pkg-resources">
        <p className="approval-pkg-panel-title">Quick links</p>
        <div className="approval-pkg-resource-row">
          <Link href={ROUTES.designs.detail(designId)} className="approval-pkg-resource-btn">
            <PackageIcon aria-hidden />
            Design
          </Link>
          <Link href={designFileDeepLink(designId)} className="approval-pkg-resource-btn">
            <FolderOpenIcon aria-hidden />
            Files
          </Link>
          <Link href={ROUTES.finance.costing} className="approval-pkg-resource-btn">
            <IndianRupeeIcon aria-hidden />
            Costing
          </Link>
          <Link href={ROUTES.quality.corrections} className="approval-pkg-resource-btn">
            <AlertTriangleIcon aria-hidden />
            Corrections
          </Link>
        </div>
      </div>

      {files.length > 0 ? (
        <div className="approval-pkg-attachments">
          <p className="approval-pkg-panel-title">Attached files · {files.length}</p>
          <ul className="approval-pkg-file-cards">
            {files.map((f) => (
              <li key={f.id}>
                <Link
                  href={designFileDeepLink(designId, f.id)}
                  className="approval-pkg-file-card"
                  title={f.fileName}
                >
                  <span className="approval-pkg-file-icon" aria-hidden>
                    <FileTextIcon />
                  </span>
                  <span className="approval-pkg-file-meta">
                    <span className="approval-pkg-file-name">{f.fileName}</span>
                    <span className="approval-pkg-file-ext">
                      {fileExt(f.fileName)}
                      {f.isPrimary ? " · Primary" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
