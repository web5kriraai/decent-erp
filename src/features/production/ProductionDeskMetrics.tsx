"use client";

import type { ReactNode } from "react";
import {
  IconAlertCircle,
  IconCheckCircle2,
  IconClipboardList,
  IconClock3,
  IconHandshake,
} from "@/components/icons";
import { cn } from "@/lib/utils";

type MetricTone = "neutral" | "danger" | "warn" | "info" | "success";

function ProductionDeskMetric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone?: MetricTone;
}) {
  const active = Number(value) > 0 && tone !== "neutral";
  return (
    <div
      className={cn(
        "production-desk-metric",
        active && `production-desk-metric--${tone}`,
      )}
    >
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
        tone="danger"
        icon={<IconAlertCircle className="size-4" />}
      />
      <ProductionDeskMetric
        label="Handoff"
        value={handoff}
        tone="warn"
        icon={<IconHandshake className="size-4" />}
      />
      <ProductionDeskMetric
        label="Instruction"
        value={instruction}
        tone="info"
        icon={<IconClipboardList className="size-4" />}
      />
      <ProductionDeskMetric
        label="Ready to release"
        value={ready}
        tone="success"
        icon={<IconCheckCircle2 className="size-4" />}
      />
      {showAwaitingLive ? (
        <ProductionDeskMetric
          label="Awaiting go-live"
          value={awaitingLive}
          tone="info"
          icon={<IconClock3 className="size-4" />}
        />
      ) : null}
    </div>
  );
}

export function ProductionDeskFlowStrip() {
  return (
    <ol className="production-desk-flow" aria-label="Release flow">
      <li className="production-desk-flow-step">
        <span className="production-desk-flow-num">1</span>
        <span className="production-desk-flow-label">Handoff</span>
        <span className="production-desk-flow-who">Design Head</span>
      </li>
      <li className="production-desk-flow-arrow" aria-hidden>
        →
      </li>
      <li className="production-desk-flow-step">
        <span className="production-desk-flow-num">2</span>
        <span className="production-desk-flow-label">Instruction</span>
        <span className="production-desk-flow-who">Production Head</span>
      </li>
      <li className="production-desk-flow-arrow" aria-hidden>
        →
      </li>
      <li className="production-desk-flow-step">
        <span className="production-desk-flow-num">3</span>
        <span className="production-desk-flow-label">Release</span>
        <span className="production-desk-flow-who">Triggers ERP</span>
      </li>
    </ol>
  );
}
