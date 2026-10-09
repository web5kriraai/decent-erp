"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { formatWorkingTotals } from "@/lib/services/time-calculation";

export type DesignerTimeStage = {
  id: string;
  sequence: number;
  status: string;
  expectedMinutes?: number | null;
  activeSeconds?: number | null;
  holdSeconds?: number | null;
  subProcess: {
    name: string;
    code: string;
    defaultRole?: { name?: string | null } | null;
  };
  assignedEmployee?: { name: string } | null;
};

/** Earlier stages on this design, in workflow order. */
export function earlierDesignerStages<T extends { id: string; sequence: number }>(
  peers: T[],
  current: { id: string; sequence: number },
): T[] {
  return peers
    .filter((peer) => peer.id !== current.id && peer.sequence < current.sequence)
    .sort((a, b) => a.sequence - b.sequence);
}

export function DesignerTimePanel({ stages }: { stages: DesignerTimeStage[] }) {
  const totalSeconds = stages.reduce((sum, stage) => sum + Math.max(0, stage.activeSeconds ?? 0), 0);

  if (stages.length === 0) {
    return (
      <p className="m-0 text-sm text-muted-foreground">
        No earlier stage time is recorded on this design yet.
      </p>
    );
  }

  return (
    <div>
      <ol className="task-stage-list">
        {stages.map((stage) => {
          const active = Math.max(0, stage.activeSeconds ?? 0);
          const hold = Math.max(0, stage.holdSeconds ?? 0);
          const person = [
            stage.assignedEmployee?.name,
            stage.subProcess.defaultRole?.name,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={stage.id} className="task-stage-row">
              <span className="task-stage-row__step" aria-hidden>
                {stage.sequence}
              </span>
              <div className="min-w-0">
                <p className="task-stage-row__title">{stage.subProcess.name}</p>
                <p className="task-stage-row__meta">{person || "Unassigned"}</p>
                <p className="task-stage-row__meta">
                  Expected {stage.expectedMinutes ?? 0} min
                  {hold > 0 ? ` · Hold ${formatWorkingTotals(hold)}` : ""}
                </p>
              </div>
              <div className="task-stage-time">
                <p className="task-stage-time__value">{formatWorkingTotals(active)}</p>
                <p className="task-stage-time__label">Active work</p>
                <StatusBadge status={stage.status} />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="task-stage-total">
        <span>Total active work</span>
        <span className="tabular-nums">{formatWorkingTotals(totalSeconds)}</span>
      </p>
    </div>
  );
}
