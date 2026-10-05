"use client";

import { AppButton } from "@/components/ui/AppButton";

export function ProductionDeskTools({
  ensurePending,
  onEnsureLadder,
}: {
  ensurePending: boolean;
  onEnsureLadder: () => void;
}) {
  return (
    <div className="production-desk-tools-bar">
      <div className="production-desk-tools-copy">
        <div className="min-w-0">
          <p className="production-desk-tools-title">Recovery</p>
          <p className="production-desk-tools-hint">
            Creates missing production ladder stages (Handoff → Instruction → Release) for
            approved designs that are stuck without those tasks.
          </p>
        </div>
      </div>
      <AppButton
        type="button"
        appVariant="outline"
        size="sm"
        disabled={ensurePending}
        onClick={onEnsureLadder}
      >
        {ensurePending ? "Ensuring…" : "Ensure production stages"}
      </AppButton>
    </div>
  );
}
