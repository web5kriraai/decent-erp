"use client";

import Link from "next/link";
import { ROUTES } from "@/config/routes";
import {
  designFileDeepLink,
  type ApprovalRequestPackage,
} from "@/lib/approval-request-package";

type ApprovalRequestPackagePanelProps = {
  package: ApprovalRequestPackage | null | undefined;
  designId: string;
};

export function ApprovalRequestPackagePanel({
  package: pkg,
  designId,
}: ApprovalRequestPackagePanelProps) {
  if (!pkg) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        No requester package was stored for this design (legacy request).{" "}
        <Link href={ROUTES.designs.detail(designId)} className="font-medium text-primary underline">
          Open design
        </Link>{" "}
        to review files, costing, and workflow.
      </div>
    );
  }

  const snap = pkg.snapshot;

  return (
    <div className="space-y-3 rounded-md border border-border bg-background px-3 py-3 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Requested by Design Head
        </p>
        <p className="mt-1 font-medium">
          {pkg.requesterName}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {new Date(pkg.requestedAtUtc).toLocaleString()}
          </span>
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Requester remark
        </p>
        <p className="mt-1 whitespace-pre-wrap">{pkg.requesterRemark}</p>
      </div>
      {pkg.summaryNote ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Summary note
          </p>
          <p className="mt-1 whitespace-pre-wrap">{pkg.summaryNote}</p>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Product:</span> {snap.productType}
        </p>
        <p>
          <span className="text-muted-foreground">Priority:</span> {snap.priority}
        </p>
        <p>
          <span className="text-muted-foreground">Open corrections:</span> {snap.openCorrections}
        </p>
        <p>
          <span className="text-muted-foreground">Costing:</span>{" "}
          {snap.costingEntryCount > 0
            ? `${snap.costingEntryCount} entries · ₹${snap.costingTotal.toLocaleString()}`
            : "None yet"}
        </p>
      </div>
      {snap.completedStages?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Completed stages
          </p>
          <p className="mt-1 text-muted-foreground">{snap.completedStages.join(" · ")}</p>
        </div>
      ) : null}
      {snap.primaryFiles?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attached files
          </p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {snap.primaryFiles.map((f) => (
              <li key={f.id}>
                <Link
                  href={designFileDeepLink(designId, f.id)}
                  className="font-medium text-primary underline"
                >
                  {f.fileName}
                </Link>
                {f.isPrimary ? " (primary)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1">
        <Link href={ROUTES.designs.detail(designId)} className="font-medium text-primary underline">
          Open design
        </Link>
        <Link href={designFileDeepLink(designId)} className="font-medium text-primary underline">
          Files
        </Link>
        <Link href={ROUTES.finance.costing} className="font-medium text-primary underline">
          Costing
        </Link>
        <Link href={ROUTES.quality.corrections} className="font-medium text-primary underline">
          Corrections
        </Link>
      </div>
    </div>
  );
}
