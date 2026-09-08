"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryState } from "@/components/ui/QueryState";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { Input } from "@/components/ui/input";
import { apiGet, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { roleKpiWeightsSumOk } from "@/lib/services/kpi-weight-utils";
import { SPEC_KPI_METRICS } from "@/lib/kpi-metrics";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config/routes";

type KpiDefinition = {
  id: number;
  roleId: number;
  metricCode: string;
  weightPercent: string | number;
  role?: { id: number; code: string; name: string };
};

type RoleGroup = {
  roleId: number;
  roleName: string;
  roleCode: string;
  metrics: KpiDefinition[];
};

const METRIC_LABELS = Object.fromEntries(
  SPEC_KPI_METRICS.map((m) => [m.code, m.label]),
) as Record<string, string>;

function metricLabel(code: string) {
  return METRIC_LABELS[code] ?? code.replaceAll("_", " ");
}

export function KpiWeightsAdminView() {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const listQuery = useQuery({
    queryKey: queryKeys.masters.kpiDefinitions,
    queryFn: () => apiGet<KpiDefinition[]>("/api/masters/kpi-definitions"),
  });

  const rows = listQuery.data ?? [];

  const roleGroups = useMemo(() => {
    const map = new Map<number, RoleGroup>();
    for (const row of rows) {
      const existing = map.get(row.roleId);
      if (existing) {
        existing.metrics.push(row);
      } else {
        map.set(row.roleId, {
          roleId: row.roleId,
          roleName: row.role?.name ?? `Role ${row.roleId}`,
          roleCode: row.role?.code ?? "",
          metrics: [row],
        });
      }
    }
    return [...map.values()].sort((a, b) => a.roleName.localeCompare(b.roleName));
  }, [rows]);

  useEffect(() => {
    if (selectedRoleId != null && roleGroups.some((g) => g.roleId === selectedRoleId)) return;
    if (roleGroups.length > 0) setSelectedRoleId(roleGroups[0].roleId);
  }, [roleGroups, selectedRoleId]);

  const activeGroup = roleGroups.find((g) => g.roleId === selectedRoleId) ?? null;

  const roleSumById = useMemo(() => {
    const map = new Map<number, number>();
    for (const group of roleGroups) {
      let sum = 0;
      for (const row of group.metrics) {
        const weight = Number(drafts[row.id] ?? row.weightPercent);
        sum += Number.isFinite(weight) ? weight : 0;
      }
      map.set(group.roleId, sum);
    }
    return map;
  }, [roleGroups, drafts]);

  const activeSum = activeGroup ? (roleSumById.get(activeGroup.roleId) ?? 0) : 0;
  const activeSumOk = roleKpiWeightsSumOk([activeSum]).ok;

  const dirtyIds = useMemo(() => {
    if (!activeGroup) return [] as number[];
    return activeGroup.metrics
      .filter((row) => {
        if (!(row.id in drafts)) return false;
        return Number(drafts[row.id]) !== Number(row.weightPercent);
      })
      .map((row) => row.id);
  }, [activeGroup, drafts]);

  const isDirty = dirtyIds.length > 0;

  const saveRole = useMutation({
    mutationFn: async () => {
      if (!activeGroup) throw new Error("No role selected");
      const weights = activeGroup.metrics.map((row) => ({
        id: row.id,
        weightPercent: Number(drafts[row.id] ?? row.weightPercent),
      }));
      return apiPatch(`/api/masters/kpi-definitions/bulk`, {
        roleId: activeGroup.roleId,
        weights,
      });
    },
    onSuccess: () => {
      setDrafts({});
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.kpiDefinitions });
      toast.success("KPI weights saved", `${activeGroup?.roleName ?? "Role"} totals 100%.`);
    },
    onError: (e) => toast.errorFromApi(e, "Could not save KPI weights"),
  });

  function setWeight(id: number, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function resetRole() {
    if (!activeGroup) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of activeGroup.metrics) delete next[row.id];
      return next;
    });
  }

  function applySpecDefaults() {
    if (!activeGroup) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of activeGroup.metrics) {
        const spec = SPEC_KPI_METRICS.find((m) => m.code === row.metricCode);
        if (spec) next[row.id] = String(spec.weight);
      }
      return next;
    });
  }

  return (
    <AppCard
      title="KPI Weightage"
      description="Pick a role, adjust metric weights, and save when the role totals 100%."
      headerAction={
        <AppButtonLink href={ROUTES.analytics.kpi} appVariant="outline" size="sm">
          Open KPI dashboard
        </AppButtonLink>
      }
      contentClassName="kpi-weights-admin"
    >
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        onRetry={() => listQuery.refetch()}
        skeletonVariant="cards"
      >
        {roleGroups.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">No KPI definitions configured.</p>
        ) : (
          <div className="kpi-weights-layout">
            <aside className="kpi-weights-roles" aria-label="Roles">
              <p className="kpi-weights-aside-label">Roles</p>
              <ul className="kpi-weights-role-list">
                {roleGroups.map((group) => {
                  const sum = roleSumById.get(group.roleId) ?? 0;
                  const ok = Math.abs(sum - 100) <= 0.01;
                  const selected = group.roleId === selectedRoleId;
                  return (
                    <li key={group.roleId}>
                      <button
                        type="button"
                        className={cn(
                          "kpi-weights-role-btn",
                          selected && "kpi-weights-role-btn--selected",
                          !ok && "kpi-weights-role-btn--warn",
                        )}
                        aria-pressed={selected}
                        onClick={() => setSelectedRoleId(group.roleId)}
                      >
                        <span className="kpi-weights-role-name">{group.roleName}</span>
                        <span className="kpi-weights-role-total">
                          {sum.toFixed(0)}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section className="kpi-weights-editor" aria-label="Role metric weights">
              {activeGroup ? (
                <>
                  <div className="kpi-weights-editor-head">
                    <div className="min-w-0">
                      <h3 className="kpi-weights-editor-title">{activeGroup.roleName}</h3>
                      <p className="kpi-weights-editor-sub">
                        {activeGroup.metrics.length} metrics · must total 100%
                      </p>
                    </div>
                    <div
                      className={cn(
                        "kpi-weights-sum-pill",
                        activeSumOk
                          ? "kpi-weights-sum-pill--ok"
                          : "kpi-weights-sum-pill--bad",
                      )}
                      aria-live="polite"
                    >
                      {activeSum.toFixed(1)}%
                    </div>
                  </div>

                  <div className="kpi-weights-sum-track" aria-hidden>
                    <div
                      className={cn(
                        "kpi-weights-sum-fill",
                        !activeSumOk && "kpi-weights-sum-fill--over",
                      )}
                      style={{ width: `${Math.min(activeSum, 100)}%` }}
                    />
                  </div>

                  <ul className="kpi-weights-metric-list">
                    {activeGroup.metrics.map((row) => {
                      const value = drafts[row.id] ?? String(row.weightPercent);
                      const numeric = Number(value);
                      const pct = Number.isFinite(numeric) ? Math.min(Math.max(numeric, 0), 100) : 0;
                      return (
                        <li key={row.id} className="kpi-weights-metric-row">
                          <div className="kpi-weights-metric-main">
                            <div className="kpi-weights-metric-copy">
                              <p className="kpi-weights-metric-label">
                                {metricLabel(row.metricCode)}
                              </p>
                              <p className="kpi-weights-metric-code">{row.metricCode}</p>
                            </div>
                            <div className="kpi-weights-metric-input">
                              <Input
                                id={`kpi-w-${row.id}`}
                                type="number"
                                min={0.01}
                                max={100}
                                step={0.5}
                                inputMode="decimal"
                                aria-label={`${metricLabel(row.metricCode)} weight percent`}
                                value={value}
                                onChange={(e) => setWeight(row.id, e.target.value)}
                              />
                              <span className="kpi-weights-metric-suffix" aria-hidden>
                                %
                              </span>
                            </div>
                          </div>
                          <div className="kpi-weights-metric-track" aria-hidden>
                            <div
                              className="kpi-weights-metric-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="kpi-weights-actions">
                    <AppButton
                      type="button"
                      appVariant="outline"
                      size="sm"
                      onClick={applySpecDefaults}
                    >
                      Spec defaults
                    </AppButton>
                    <AppButton
                      type="button"
                      appVariant="ghost"
                      size="sm"
                      disabled={!isDirty}
                      onClick={resetRole}
                    >
                      Reset
                    </AppButton>
                    <AppButton
                      type="button"
                      size="sm"
                      className="kpi-weights-save"
                      disabled={!isDirty || !activeSumOk || saveRole.isPending}
                      onClick={() => saveRole.mutate()}
                    >
                      {saveRole.isPending ? "Saving…" : "Save role weights"}
                    </AppButton>
                  </div>
                  {!activeSumOk ? (
                    <p className="kpi-weights-hint" role="status">
                      Adjust weights so this role totals exactly 100% before saving.
                    </p>
                  ) : isDirty ? (
                    <p className="kpi-weights-hint kpi-weights-hint--ok" role="status">
                      Ready to save {dirtyIds.length} change
                      {dirtyIds.length === 1 ? "" : "s"}.
                    </p>
                  ) : (
                    <p className="kpi-weights-hint kpi-weights-hint--muted" role="status">
                      No unsaved changes for this role.
                    </p>
                  )}
                </>
              ) : null}
            </section>
          </div>
        )}
      </QueryState>
    </AppCard>
  );
}
