"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { QueryState } from "@/components/ui/QueryState";
import {
  useRolePermissionMatrix,
  useUpdateRolePermissions,
} from "@/hooks/use-admin-roles";
import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";

type Props = {
  roleId: number;
  roleCode: string;
  roleName: string;
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionCode[];

export function RolePermissionEditor({ roleId, roleCode, roleName }: Props) {
  const matrixQuery = useRolePermissionMatrix(roleId);
  const updatePermissions = useUpdateRolePermissions();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);

  const serverSelected = useMemo(
    () =>
      new Set(
        matrixQuery.data?.permissions.filter((p) => p.assigned).map((p) => p.code) ?? [],
      ),
    [matrixQuery.data],
  );

  if (!dirty && matrixQuery.data && matrixQuery.dataUpdatedAt !== syncedAt) {
    setSyncedAt(matrixQuery.dataUpdatedAt);
    setSelected(serverSelected);
  }

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    updatePermissions.mutate(
      { roleId, permissionCodes: [...selected] },
      { onSuccess: () => setDirty(false) },
    );
  }

  return (
    <div className="role-perm-editor">
      <div className="role-perm-editor-header">
        <h3>{roleName}</h3>
        <code className="role-code-tag">{roleCode}</code>
        {dirty && (
          <AppButton
            type="button"
            appVariant="primary"
            size="sm"
            disabled={updatePermissions.isPending || selected.size === 0}
            onClick={handleSave}
          >
            {updatePermissions.isPending ? "Saving…" : "Save permissions"}
          </AppButton>
        )}
      </div>

      <QueryState
        isLoading={matrixQuery.isLoading}
        isError={matrixQuery.isError}
        error={matrixQuery.error}
        onRetry={() => matrixQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="role-perm-grid">
          {ALL_PERMISSIONS.map((code) => {
            const meta = matrixQuery.data?.permissions.find((p) => p.code === code);
            const checked = selected.has(code);
            const isAdminLock = roleCode === "ADMIN" && code === PERMISSIONS.MASTER_ADMIN;

            return (
              <label key={code} className={`role-perm-check ${checked ? "role-perm-check--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isAdminLock}
                  onChange={() => toggle(code)}
                />
                <span>
                  <strong>{code.replace(/_/g, " ")}</strong>
                  {meta?.name && meta.name !== code ? (
                    <small>{meta.name}</small>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
        {roleCode === "ADMIN" && (
          <p className="form-hint mt-3">
            System Admin must retain MASTER_ADMIN permission.
          </p>
        )}
      </QueryState>
    </div>
  );
}
