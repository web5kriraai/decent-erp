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
    <AppButton
      type="button"
      appVariant="outline"
      size="sm"
      disabled={ensurePending}
      title="Creates missing Handoff, Instruction, and Release stages for approved designs that are stuck."
      onClick={onEnsureLadder}
    >
      {ensurePending ? "Ensuring…" : "Ensure stages"}
    </AppButton>
  );
}
