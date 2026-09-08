"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { ModalForm, ModalFormGrid } from "@/components/ui/Modal";
import {
  useDesignKpiContribution,
  useSubmitCreativityRating,
} from "@/hooks/use-design-kpi";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import type { DesignSummary } from "@/lib/types/api";

export function KraKpiPanel({ design }: { design: DesignSummary }) {
  const { data: session } = useSession();
  const contribution = useDesignKpiContribution(design.id, true);
  const submitRating = useSubmitCreativityRating(design.id);
  const canRate =
    (session?.user?.permissions ?? []).includes(PERMISSIONS.DESIGN_APPROVE) ||
    session?.user?.roleCode === ROLE_CODES.DESIGN_HEAD ||
    (session?.user?.permissions ?? []).includes(PERMISSIONS.KPI_ADMIN);

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [score, setScore] = useState("80");

  const contributors = contribution.data?.contributors ?? [];

  async function handleRate() {
    if (!employeeId) return;
    await submitRating.mutateAsync({
      employeeId: Number(employeeId),
      score: Number(score),
    });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <AppCard title="Current Team Contribution">
        {contribution.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading contribution…</p>
        ) : contributors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contributors on this design yet.</p>
        ) : (
          <ul className="space-y-2">
            {contributors.map((c) => (
              <li
                key={c.employeeId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-foreground">{c.name}</span>
                <span className="font-semibold">
                  {c.score}/{c.maxScore}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      {canRate && contributors.length > 0 && !open ? (
        <AppButton type="button" appVariant="outline" size="sm" onClick={() => setOpen(true)}>
          Rate Creativity
        </AppButton>
      ) : null}

      {canRate && open ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
          <h3 className="text-sm font-semibold">Creativity / Design Quality</h3>
          <ModalForm className="gap-3">
            <ModalFormGrid>
              <FormSelect
                id="rateEmployee"
                label="Employee"
                value={employeeId || null}
                onValueChange={(v) => setEmployeeId(v ?? "")}
                options={contributors.map((c) => ({
                  value: String(c.employeeId),
                  label: c.name,
                }))}
                placeholder="Select employee"
              />
              <FormTextField
                id="rateScore"
                label="Score (0–100)"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </ModalFormGrid>
          </ModalForm>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AppButton type="button" appVariant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              disabled={submitRating.isPending}
              onClick={() => void handleRate()}
            >
              {submitRating.isPending ? "Saving…" : "Save Rating"}
            </AppButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
