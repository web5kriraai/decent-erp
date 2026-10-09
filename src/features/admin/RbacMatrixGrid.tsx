"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/ui/QueryState";
import {
  useFullRbacMatrix,
  useRestoreRolePermissions,
  useUpdateRolePermissions,
} from "@/hooks/use-admin-roles";
import { PERMISSIONS, ROLE_CODES, type PermissionCode } from "@/lib/permissions";
import { formatPermissionLabel } from "@/lib/user-messages";
import { cn } from "@/lib/utils";

type MatrixState = Map<string, Set<string>>;

const PERMISSION_GROUPS: Array<{ title: string; codes: PermissionCode[] }> = [
  {
    title: "Concepts",
    codes: [
      PERMISSIONS.DESIGN_CREATE,
      PERMISSIONS.DESIGN_ASSIGN,
      PERMISSIONS.DESIGN_ASSIGN_MANUAL,
      PERMISSIONS.DESIGN_ASSIGN_AUTO,
      PERMISSIONS.DESIGN_REASSIGN,
    ],
  },
  {
    title: "Tasks and time",
    codes: [
      PERMISSIONS.TASK_EXECUTE,
      PERMISSIONS.TIME_VIEW_TEAM,
      PERMISSIONS.WORKFLOW_VIEW_HISTORY,
      PERMISSIONS.WORKFLOW_OVERRIDE,
    ],
  },
  {
    title: "Corrections",
    codes: [
      PERMISSIONS.CORRECTION_RAISE,
      PERMISSIONS.CORRECTION_REQUEST,
      PERMISSIONS.CORRECTION_EXECUTE,
      PERMISSIONS.CORRECTION_APPROVE,
      PERMISSIONS.CORRECTION_REJECT,
    ],
  },
  {
    title: "Approvals",
    codes: [
      PERMISSIONS.DESIGN_APPROVE,
      PERMISSIONS.APPROVE_LEVEL_1,
      PERMISSIONS.APPROVE_SKETCH,
      PERMISSIONS.FINAL_APPROVE,
      PERMISSIONS.MARK_LIVE,
    ],
  },
  {
    title: "Cost and KPI",
    codes: [PERMISSIONS.COST_VIEW, PERMISSIONS.COST_ENTER, PERMISSIONS.KPI_ADMIN],
  },
  {
    title: "Production and ERP",
    codes: [
      PERMISSIONS.PRODUCTION_RELEASE,
      PERMISSIONS.ERP_FLOOR_OPERATE,
      PERMISSIONS.ERP_SALES_OPERATE,
      PERMISSIONS.ERP_ACCOUNTS_OPERATE,
    ],
  },
  {
    title: "Administration",
    codes: [PERMISSIONS.MASTER_ADMIN],
  },
];

function sentenceLabel(code: string) {
  const label = formatPermissionLabel(code);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMatrixState(
  rows: Array<{ permissionCode: string; roles: Array<{ roleId: number; assigned: boolean }> }>,
): MatrixState {
  const state = new Map<string, Set<string>>();
  for (const row of rows) {
    state.set(
      row.permissionCode,
      new Set(row.roles.filter((role) => role.assigned).map((role) => String(role.roleId))),
    );
  }
  return state;
}

export function RbacMatrixGrid() {
  const matrixQuery = useFullRbacMatrix();
  const updatePermissions = useUpdateRolePermissions();
  const restoreDefaults = useRestoreRolePermissions();
  const [localMatrix, setLocalMatrix] = useState<MatrixState>(new Map());
  const [dirtyRoles, setDirtyRoles] = useState<Set<number>>(new Set());
  const [syncedAt, setSyncedAt] = useState(0);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [roleQuery, setRoleQuery] = useState("");

  const serverMatrix = useMemo(
    () => (matrixQuery.data ? buildMatrixState(matrixQuery.data.matrix) : new Map()),
    [matrixQuery.data],
  );

  if (matrixQuery.data && matrixQuery.dataUpdatedAt !== syncedAt && dirtyRoles.size === 0) {
    setSyncedAt(matrixQuery.dataUpdatedAt);
    setLocalMatrix(serverMatrix);
  }

  const roles = matrixQuery.data?.roles ?? [];
  const rows = matrixQuery.data?.matrix ?? [];
  const selected = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;

  const rowByCode = useMemo(
    () => new Map(rows.map((row) => [row.permissionCode, row])),
    [rows],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const used = new Set<string>();
    const grouped = PERMISSION_GROUPS.map((group) => {
      const items = group.codes
        .map((code) => rowByCode.get(code))
        .filter((row): row is NonNullable<typeof row> => row != null)
        .filter((row) => {
          if (!q) return true;
          return (
            row.permissionName.toLowerCase().includes(q) ||
            row.permissionCode.toLowerCase().includes(q) ||
            formatPermissionLabel(row.permissionCode).toLowerCase().includes(q)
          );
        });
      for (const item of items) used.add(item.permissionCode);
      return { title: group.title, items };
    }).filter((group) => group.items.length > 0);

    const leftover = rows.filter((row) => {
      if (used.has(row.permissionCode)) return false;
      if (!q) return true;
      return (
        row.permissionName.toLowerCase().includes(q) ||
        row.permissionCode.toLowerCase().includes(q) ||
        formatPermissionLabel(row.permissionCode).toLowerCase().includes(q)
      );
    });
    if (leftover.length) grouped.push({ title: "Other", items: leftover });
    return grouped;
  }, [query, rowByCode, rows]);

  function isAssigned(permissionCode: string, roleId: number): boolean {
    return localMatrix.get(permissionCode)?.has(String(roleId)) ?? false;
  }

  function assignedCount(roleId: number) {
    return rows.filter((row) => isAssigned(row.permissionCode, roleId)).length;
  }

  const visibleRoles = roles.filter((role) => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      role.displayName.toLowerCase().includes(q) || role.code.toLowerCase().includes(q)
    );
  });

  function setGroupAssigned(roleId: number, roleCode: string, codes: string[], assigned: boolean) {
    setLocalMatrix((prev) => {
      const next = new Map(prev);
      for (const code of codes) {
        if (roleCode === ROLE_CODES.ADMIN && code === PERMISSIONS.MASTER_ADMIN) continue;
        const roleSet = new Set(next.get(code) ?? []);
        if (assigned) roleSet.add(String(roleId));
        else roleSet.delete(String(roleId));
        next.set(code, roleSet);
      }
      return next;
    });
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  }

  function toggleCell(permissionCode: string, roleId: number, roleCode: string) {
    if (roleCode === ROLE_CODES.ADMIN && permissionCode === PERMISSIONS.MASTER_ADMIN) return;

    setLocalMatrix((prev) => {
      const next = new Map(prev);
      const roleSet = new Set(next.get(permissionCode) ?? []);
      const key = String(roleId);
      if (roleSet.has(key)) roleSet.delete(key);
      else roleSet.add(key);
      next.set(permissionCode, roleSet);
      return next;
    });
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  }

  function permissionCodesForRole(roleId: number): string[] {
    return rows
      .filter((row) => isAssigned(row.permissionCode, roleId))
      .map((row) => row.permissionCode);
  }

  async function saveRole(roleId: number) {
    await updatePermissions.mutateAsync({
      roleId,
      permissionCodes: permissionCodesForRole(roleId),
    });
    setDirtyRoles((prev) => {
      const next = new Set(prev);
      next.delete(roleId);
      return next;
    });
  }

  async function handleRestore(roleId: number) {
    await restoreDefaults.mutateAsync(roleId);
    setDirtyRoles((prev) => {
      const next = new Set(prev);
      next.delete(roleId);
      return next;
    });
  }

  const isSaving = updatePermissions.isPending || restoreDefaults.isPending;

  return (
    <QueryState
      isLoading={matrixQuery.isLoading}
      isError={matrixQuery.isError}
      error={matrixQuery.error}
      onRetry={() => matrixQuery.refetch()}
      skeletonVariant="table"
    >
      <div className="rbac-console">
        <aside className="rbac-console__roles">
          <div className="rbac-console__pane-head">
            <h2 className="m-0 text-sm font-semibold text-foreground">Roles</h2>
            <Input
              type="search"
              value={roleQuery}
              onChange={(event) => setRoleQuery(event.target.value)}
              placeholder="Find a role…"
              aria-label="Find a role"
            />
          </div>
          <div className="rbac-console__scroll" role="listbox" aria-label="Roles">
            {visibleRoles.map((role) => {
              const active = selected?.id === role.id;
              const dirty = dirtyRoles.has(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn("rbac-console__role", active && "is-active")}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {role.displayName}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {assignedCount(role.id)} of {rows.length}
                    {role.employeeCount === 1
                      ? " · 1 person"
                      : ` · ${role.employeeCount} people`}
                    {dirty ? " · Unsaved" : ""}
                  </span>
                </button>
              );
            })}
            {visibleRoles.length === 0 ? (
              <p className="m-0 px-3 py-2 text-sm text-muted-foreground">No roles match.</p>
            ) : null}
          </div>
        </aside>

        {selected ? (
          <section className="rbac-console__editor" aria-label={`${selected.displayName} permissions`}>
            <div className="rbac-console__pane-head rbac-console__editor-head">
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-semibold text-foreground">{selected.displayName}</h2>
                <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                  {selected.code} · {assignedCount(selected.id)} permissions on
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AppButton
                  type="button"
                  appVariant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => void handleRestore(selected.id)}
                >
                  Reset defaults
                </AppButton>
                <AppButton
                  type="button"
                  size="sm"
                  disabled={isSaving || !dirtyRoles.has(selected.id)}
                  onClick={() => void saveRole(selected.id)}
                >
                  {isSaving ? "Saving…" : "Save changes"}
                </AppButton>
              </div>
            </div>
            <div className="rbac-console__filter">
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter permissions…"
                aria-label="Filter permissions"
              />
            </div>
            <div className="rbac-console__scroll">
              {groups.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">
                  No permissions match “{query.trim()}”.
                </p>
              ) : (
                groups.map((group) => {
                  const codes = group.items.map((row) => row.permissionCode);
                  const editable = codes.filter(
                    (code) =>
                      !(
                        selected.code === ROLE_CODES.ADMIN &&
                        code === PERMISSIONS.MASTER_ADMIN
                      ),
                  );
                  const allOn =
                    editable.length > 0 &&
                    editable.every((code) => isAssigned(code, selected.id));
                  return (
                    <section key={group.title} className="rbac-console__group">
                      <div className="rbac-console__group-head">
                        <h3 className="m-0 text-sm font-semibold text-foreground">{group.title}</h3>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={allOn}
                            disabled={isSaving || editable.length === 0}
                            onChange={() =>
                              setGroupAssigned(selected.id, selected.code, editable, !allOn)
                            }
                            aria-label={`Select all ${group.title}`}
                          />
                          Select all
                        </label>
                      </div>
                      <ul className="m-0 list-none p-0">
                        {group.items.map((row) => {
                          const checked = isAssigned(row.permissionCode, selected.id);
                          const locked =
                            selected.code === ROLE_CODES.ADMIN &&
                            row.permissionCode === PERMISSIONS.MASTER_ADMIN;
                          const inputId = `perm-${selected.id}-${row.permissionCode}`;
                          return (
                            <li key={row.permissionCode}>
                              <label htmlFor={inputId} className="rbac-console__perm">
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  checked={checked}
                                  disabled={locked || isSaving}
                                  onChange={() =>
                                    toggleCell(row.permissionCode, selected.id, selected.code)
                                  }
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm text-foreground">
                                    {sentenceLabel(row.permissionCode)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {row.permissionCode}
                                    {locked ? " · Required for System Admin" : ""}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
      </div>
    </QueryState>
  );
}
