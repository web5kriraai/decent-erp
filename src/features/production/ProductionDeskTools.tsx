"use client";

import { AppButton } from "@/components/ui/AppButton";
import { WrenchIcon } from "lucide-react";

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
        <span className="production-desk-tools-icon" aria-hidden>
          <WrenchIcon className="size-4" />
        </span>
        <div>
          <p className="production-desk-tools-title">Recovery</p>
          <p className="production-desk-tools-hint">
            Create missing PROD_* stages for stuck approved designs.
          </p>
        </div>
      </div>
      <AppButton
        type="button"
        appVariant="secondary"
        size="sm"
        disabled={ensurePending}
        onClick={onEnsureLadder}
      >
        {ensurePending ? "Ensuring…" : "Ensure production stages"}
      </AppButton>
    </div>
  );
}
