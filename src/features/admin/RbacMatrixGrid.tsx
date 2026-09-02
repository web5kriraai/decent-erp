"use client";

import { useMemo, useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import {
  useFullRbacMatrix,
  useRestoreRolePermissions,
  useUpdateRolePermissions,
} from "@/hooks/use-admin-roles";
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

export function RbacMatrixGrid() {
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
          Toggle access for each role. Changes apply on save — people in that role should sign out
          and back in to pick them up.
        </p>
        <p className="form-hint">{sessionPermissionsStaleHint()}</p>
      </div>

      <QueryState
        isLoading={matrixQuery.isLoading}
        isError={matrixQuery.isError}
        error={matrixQuery.error}
        onRetry={() => matrixQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="rbac-matrix-scroll scroll-region">
          <table className="rbac-matrix-table">
            <thead>
              <tr>
                <th scope="col">Permission</th>
                {roles.map((role) => (
                  <th key={role.id} scope="col" className="rbac-matrix-role-col">
                    <span className="rbac-matrix-role-name">{role.displayName}</span>
                    <code className="role-code-tag">{role.code}</code>
                    <div className="rbac-matrix-role-actions">
                      {dirtyRoles.has(role.id) ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          disabled={isSaving}
                          onClick={() => void saveRole(role.id)}
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          disabled={isSaving}
                          onClick={() => void handleRestore(role.id)}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.permissionCode}>
                  <th scope="row" className="rbac-matrix-perm-cell">
                    <strong>{row.permissionName}</strong>
                    <span>{formatPermissionLabel(row.permissionCode)}</span>
                    <code className="role-code-tag">{row.permissionCode}</code>
                  </th>
                  {roles.map((role) => {
                    const cellRole = row.roles.find((r) => r.roleId === role.id);
                    const checked = cellRole ? isAssigned(row.permissionCode, role.id) : false;
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
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  );
}
