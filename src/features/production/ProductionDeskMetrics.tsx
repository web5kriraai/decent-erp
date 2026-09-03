"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ProductionDeskMetric({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className={cn("production-desk-metric", accent && "production-desk-metric--accent")}>
      <span className="production-desk-metric-icon" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="production-desk-metric-label">{label}</p>
        <p className="production-desk-metric-value">{value}</p>
      </div>
    </div>
  );
}

export function ProductionDeskMetrics({
  blocked,
  handoff,
  instruction,
  ready,
  awaitingLive,
  showAwaitingLive,
}: {
  blocked: number;
  handoff: number;
  instruction: number;
  ready: number;
  awaitingLive: number;
  showAwaitingLive: boolean;
}) {
  return (
    <div className="production-desk-metric-row" role="group" aria-label="Production queue summary">
      <ProductionDeskMetric
        label="Blocked"
        value={blocked}
        accent={blocked > 0}
        icon={
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8" />
          </svg>
        }
      />
      <ProductionDeskMetric
        label="Handoff"
        value={handoff}
        accent={handoff > 0}
        icon={
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17L17 7M8 7h9v9" />
          </svg>
        }
      />
      <ProductionDeskMetric
        label="Instruction"
        value={instruction}
        accent={instruction > 0}
        icon={
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h10M4 18h14" />
          </svg>
        }
      />
      <ProductionDeskMetric
        label="Ready to release"
        value={ready}
        accent={ready > 0}
        icon={
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12l4 4L19 6" />
          </svg>
        }
      />
      {showAwaitingLive ? (
        <ProductionDeskMetric
          label="Awaiting go-live"
          value={awaitingLive}
          accent={awaitingLive > 0}
          icon={
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
        />
      ) : null}
    </div>
  );
}
