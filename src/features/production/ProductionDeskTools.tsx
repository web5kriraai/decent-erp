"use client";

import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";

export function ProductionDeskTools({
  ensurePending,
  onEnsureLadder,
}: {
  ensurePending: boolean;
  onEnsureLadder: () => void;
}) {
  return (
    <AppCard
      title="Desk tools"
      className="stack-section"
      description="Recovery actions for stuck approved designs."
    >
      <div className="production-desk-tools">
        <AppButton
          type="button"
          appVariant="secondary"
          size="sm"
          disabled={ensurePending}
          onClick={onEnsureLadder}
        >
          {ensurePending ? "Ensuring stages…" : "Ensure production stages"}
        </AppButton>
        <p className="production-desk-tools-hint">
          Use when Spec 8-Step / custom patterns were approved but Production Handoff never
          appeared. Adds PROD_* tasks and unlocks handoff.
        </p>
      </div>
    </AppCard>
  );
}
