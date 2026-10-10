"use client";

import { useSession } from "next-auth/react";
import { AppButtonLink } from "@/components/ui/AppButton";
import { ROUTES } from "@/config/routes";
import { ROLE_CODES } from "@/lib/permissions";
import { releaseApprovalNotice } from "@/lib/erp-stage-guidance";

const STEPS = [
  {
    role: "Design Head",
    action: "opens Approvals, then Send to Management, and sends this design.",
  },
  {
    role: "Management",
    action: "opens Approvals and approves this design.",
  },
  {
    role: "Production Head",
    action: "ends Production Release after the design status is Approved.",
  },
] as const;

export function ApprovalPathCard({
  designId,
  designStatus,
}: {
  designId?: string;
  designStatus: string;
}) {
  const { data: session } = useSession();
  const roleCode = session?.user?.roleCode;
  const notice = releaseApprovalNotice(designStatus);
  if (!notice) return null;

  const waitingOnManagement = designStatus === "APPROVAL_PENDING";
  const currentStep = waitingOnManagement ? 1 : 0;
  const canRequest =
    !!designId &&
    !waitingOnManagement &&
    (roleCode === ROLE_CODES.DESIGN_HEAD || roleCode === ROLE_CODES.ADMIN);
  const canApprove =
    waitingOnManagement &&
    (roleCode === ROLE_CODES.MANAGEMENT || roleCode === ROLE_CODES.ADMIN);

  return (
    <div className="erp-chain-notice" role="status">
      <p className="erp-chain-notice-title">How to approve</p>
      <p className="erp-chain-notice-body">{notice.body}</p>
      <ol className="erp-chain-notice-steps">
        {STEPS.map((step, index) => (
          <li
            key={step.role}
            data-current={index === currentStep ? "true" : undefined}
            data-done={index < currentStep ? "true" : undefined}
          >
            <span className="erp-chain-notice-step-role">{step.role}</span>
            {" "}
            {step.action}
          </li>
        ))}
      </ol>
      {canRequest && designId ? (
        <AppButtonLink href={ROUTES.quality.requestSignOff(designId)} size="sm">
          Request sign-off
        </AppButtonLink>
      ) : null}
      {canApprove ? (
        <AppButtonLink href={`${ROUTES.quality.approvals}?tab=management`} size="sm">
          Open Approvals
        </AppButtonLink>
      ) : null}
    </div>
  );
}

export function isApprovalGapMessage(message: string): boolean {
  return /sign-off|approvals|must be approved|management approval/i.test(message);
}
