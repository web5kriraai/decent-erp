"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { RbacMatrixGrid } from "@/features/admin/RbacMatrixGrid";
import { RbacPeopleStep } from "@/features/admin/RbacPeopleStep";
import { RoleCatalogList } from "@/features/admin/RoleCatalogView";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useState } from "react";

type RbacStep = "people" | "matrix" | "guide";

const STEPS: { id: RbacStep; label: string; hint: string }[] = [
  {
    id: "people",
    label: "1. People & roles",
    hint: "User names under each role",
  },
  {
    id: "matrix",
    label: "2. Permissions",
    hint: "Permission column × roles",
  },
  {
    id: "guide",
    label: "3. Role guide",
    hint: "Defaults & responsibilities",
  },
];

export function RolesAdminView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const [step, setStep] = useState<RbacStep>("people");

  if (!permissions.includes(PERMISSIONS.MASTER_ADMIN)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Roles & Access"
        subtitle="Stepwise RBAC: assign people to roles, then grant permissions. Access is role-based and scoped across the app."
      />

      <nav className="rbac-stepper" aria-label="Roles and access steps">
        {STEPS.map((s, index) => {
          const active = step === s.id;
          const currentIndex = STEPS.findIndex((x) => x.id === step);
          const done = index < currentIndex;
          return (
            <button
              key={s.id}
              type="button"
              className={cn(
                "rbac-stepper-item",
                active && "rbac-stepper-item--active",
                done && "rbac-stepper-item--done",
              )}
              onClick={() => setStep(s.id)}
              aria-current={active ? "step" : undefined}
            >
              <span className="rbac-stepper-label">{s.label}</span>
              <span className="rbac-stepper-hint">{s.hint}</span>
            </button>
          );
        })}
      </nav>

      {step === "people" ? <RbacPeopleStep onContinue={() => setStep("matrix")} /> : null}
      {step === "matrix" ? (
        <RbacMatrixGrid
          onBack={() => setStep("people")}
          onContinue={() => setStep("guide")}
        />
      ) : null}
      {step === "guide" ? (
        <div className="space-y-3">
          <div className="rbac-step-nav">
            <button
              type="button"
              className="rbac-step-continue"
              onClick={() => setStep("matrix")}
            >
              ← Back to permissions
            </button>
          </div>
          <RoleCatalogList />
        </div>
      ) : null}
    </div>
  );
}
