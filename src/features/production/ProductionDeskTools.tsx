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
      <p className="production-desk-tools-title">Recovery</p>
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
