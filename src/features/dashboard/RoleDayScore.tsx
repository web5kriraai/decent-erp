"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppCard } from "@/components/ui/AppCard";
import { FormTextField } from "@/components/ui/form-text-field";
import { StatCard } from "@/components/ui/StatCard";
import { useMyDayKpi } from "@/hooks/use-tasks";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { WorkdayStatusBanner } from "@/features/time/WorkdayStatusBanner";

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const PLACEHOLDER_CARDS = ["Assigned", "Completed", "Rework", "Assigned today"] as const;

export function RoleDayScore({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const canScore = hasPermission(session?.user?.permissions ?? [], PERMISSIONS.TASK_EXECUTE);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const today = todayInputValue();
    setFrom(today);
    setTo(today);
  }, []);

  const dayQuery = useMyDayKpi(from, to, canScore);
  if (!canScore) return null;

  const data = dayQuery.data;
  const today = todayInputValue();
  const cards = data?.cards ?? PLACEHOLDER_CARDS.map((label) => ({
    label,
    value: "-",
    trend: "",
    tone: "default" as const,
  }));

  return (
    <>
    {compact ? null : <WorkdayStatusBanner />}
    <AppCard
      className={compact ? "workflow-dash-day" : undefined}
      title={data?.title ?? "My performance"}
      description={
        data?.description ??
        "Assigned, completed, and rework follow the dates you pick. Assigned today is designs given to you today, even if the due date is later."
      }
      headerAction={
        <div className="flex flex-wrap items-end gap-2">
          <FormTextField
            id="role-work-from"
            label="From"
            type="date"
            value={from}
            max={to || today}
            fieldClassName="w-36"
            onChange={(event) => {
              const next = event.target.value;
              setFrom(next);
              if (to && next > to) setTo(next);
            }}
          />
          <FormTextField
            id="role-work-to"
            label="To"
            type="date"
            value={to}
            min={from || undefined}
            max={today}
            fieldClassName="w-36"
            onChange={(event) => {
              const next = event.target.value;
              setTo(next);
              if (from && next < from) setFrom(next);
            }}
          />
        </div>
      }
    >
      <div className={compact ? "stat-grid workflow-dash-stats" : "stat-grid"}>
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            trend={card.trend || undefined}
            tone={card.tone}
          />
        ))}
      </div>
    </AppCard>
    </>
  );
}
