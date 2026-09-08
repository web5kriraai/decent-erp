"use client";

import { Fragment, useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { QueryState } from "@/components/ui/QueryState";
import {
  useFullRbacMatrix,
  useRestoreRolePermissions,
  useUpdateRolePermissions,
} from "@/hooks/use-admin-roles";
import {
  PERMISSION_GROUP_META,
  type PermissionGroupCode,
  formatPermissionTitle,
} from "@/lib/permission-catalog";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import { formatPermissionLabel, sessionPermissionsStaleHint } from "@/lib/user-messages";

type MatrixState = Map<string, Set<string>>;

function buildMatrixState(
  rows: Array<{ permissionCode: string; roles: Array<{ roleId: number; assigned: boolean }> }>,
): MatrixState {
  const state = new Map<string, Set<string>>();
  for (const row of rows) {
    const assignedRoleIds = new Set(
      row.roles.filter((r) => r.assigned).map((r) => String(r.roleId)),
    );
    state.set(row.permissionCode, assignedRoleIds);
  }
  return state;
}

export function RbacMatrixGrid({ onBack, onContinue }: { onBack?: () => void; onContinue?: () => void }) {
  const matrixQuery = useFullRbacMatrix();
  const updatePermissions = useUpdateRolePermissions();
  const restoreDefaults = useRestoreRolePermissions();
  const [localMatrix, setLocalMatrix] = useState<MatrixState>(new Map());
  const [dirtyRoles, setDirtyRoles] = useState<Set<number>>(new Set());
  const [syncedAt, setSyncedAt] = useState(0);

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

  const groupedRows = useMemo(() => {
    const groups: Array<{
      group: PermissionGroupCode;
      title: string;
      rows: typeof rows;
    }> = [];
    const order = new Map(
      Object.entries(PERMISSION_GROUP_META).map(([k, v]) => [k, v.sortOrder]),
    );
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const g = row.permissionGroup || "SYSTEM";
      const list = map.get(g) ?? [];
      list.push(row);
      map.set(g, list);
    }
    for (const [group, list] of [...map.entries()].sort(
      (a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99),
    )) {
      groups.push({
        group: group as PermissionGroupCode,
        title: PERMISSION_GROUP_META[group as PermissionGroupCode]?.title ?? group,
        rows: list,
      });
    }
    return groups;
  }, [rows]);

  function isAssigned(permissionCode: string, roleId: number): boolean {
    return localMatrix.get(permissionCode)?.has(String(roleId)) ?? false;
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
    <div className="rbac-matrix-panel">
      <div className="rbac-matrix-intro">
        <p>
          Permission column (left) × role columns. Toggle access per role, then Save. People from
          step 1 inherit these grants automatically.
        </p>
        <p className="form-hint">{sessionPermissionsStaleHint()}</p>
        {(onBack || onContinue) && (
          <div className="rbac-step-nav">
            {onBack ? (
              <button type="button" className="rbac-step-continue" onClick={onBack}>
                ← Back to people
              </button>
            ) : null}
            {onContinue ? (
              <button type="button" className="rbac-step-continue" onClick={onContinue}>
                Continue to role guide →
              </button>
            ) : null}
          </div>
        )}
      </div>

      <QueryState
        isLoading={matrixQuery.isLoading}
        isError={matrixQuery.isError}
        error={matrixQuery.error}
        onRetry={() => matrixQuery.refetch()}
        skeletonVariant="table"
      >
        <AppCard contentClassName="p-0">
          <div className="rbac-matrix-scroll scroll-region">
            <table className="rbac-matrix-table">
              <thead>
                <tr>
                  <th scope="col" className="rbac-matrix-perm-col-head">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th key={role.id} scope="col" className="rbac-matrix-role-col">
                      <span className="rbac-matrix-role-name">{role.displayName}</span>
                      <code className="role-code-tag">{role.code}</code>
                      <span
                        className="rbac-matrix-role-people"
                        title={(role.employees ?? []).map((e) => e.name).join(", ") || "No people"}
                      >
                        {(role.employees ?? []).length > 0
                          ? (role.employees ?? [])
                              .slice(0, 2)
                              .map((e) => e.name)
                              .join(", ") +
                            ((role.employees ?? []).length > 2
                              ? ` +${(role.employees ?? []).length - 2}`
                              : "")
                          : "No people"}
                      </span>
                      <div className="rbac-matrix-role-actions">
                        {dirtyRoles.has(role.id) ? (
                          <AppButton
                            type="button"
                            appVariant="primary"
                            size="xs"
                            disabled={isSaving}
                            onClick={() => void saveRole(role.id)}
                          >
                            Save
                          </AppButton>
                        ) : (
                          <AppButton
                            type="button"
                            appVariant="ghost"
                            size="xs"
                            disabled={isSaving}
                            onClick={() => void handleRestore(role.id)}
                          >
                            Reset
                          </AppButton>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <Fragment key={`g-${group.group}`}>
                    <tr className="rbac-matrix-group-row">
                      <th
                        colSpan={roles.length + 1}
                        scope="colgroup"
                        className="rbac-matrix-group-cell"
                      >
                        {group.title}
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.permissionCode}>
                        <th scope="row" className="rbac-matrix-perm-cell">
                          <strong>{formatPermissionTitle(row.permissionCode)}</strong>
                          <span>{formatPermissionLabel(row.permissionCode)}</span>
                          <code className="role-code-tag">{row.permissionCode}</code>
                        </th>
                        {roles.map((role) => {
                          const checked = isAssigned(row.permissionCode, role.id);
                          const locked =
                            role.code === ROLE_CODES.ADMIN &&
                            row.permissionCode === PERMISSIONS.MASTER_ADMIN;

                          return (
                            <td key={role.id} className="rbac-matrix-cell">
                              <label className="rbac-matrix-toggle">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={locked || isSaving}
                                  aria-label={`${row.permissionCode} for ${role.code}`}
                                  onChange={() =>
                                    toggleCell(row.permissionCode, role.id, role.code)
                                  }
                                />
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      </QueryState>
    </div>
  );
}
