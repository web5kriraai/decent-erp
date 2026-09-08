"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { QueryState } from "@/components/ui/QueryState";
import {
  useRolePermissionMatrix,
  useUpdateRolePermissions,
} from "@/hooks/use-admin-roles";
import {
  listPermissionsByGroup,
  formatPermissionTitle,
} from "@/lib/permission-catalog";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";

type Props = {
  roleId: number;
  roleCode: string;
  roleName: string;
};

export function RolePermissionEditor({ roleId, roleCode, roleName }: Props) {
  const matrixQuery = useRolePermissionMatrix(roleId);
  const updatePermissions = useUpdateRolePermissions();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);

  const groups = useMemo(() => listPermissionsByGroup(), []);

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
        <div className="role-perm-groups">
          {groups.map((group) => (
            <div key={group.group} className="role-perm-group">
              <h4 className="role-perm-group-title">{group.meta.title}</h4>
              <p className="role-perm-group-desc">{group.meta.description}</p>
              <div className="role-perm-grid">
                {group.permissions.map((def) => {
                  const checked = selected.has(def.code);
                  const isAdminLock =
                    roleCode === ROLE_CODES.ADMIN && def.code === PERMISSIONS.MASTER_ADMIN;

                  return (
                    <label
                      key={def.code}
                      className={`role-perm-check ${checked ? "role-perm-check--on" : ""}`}
                      title={def.description}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isAdminLock}
                        onChange={() => toggle(def.code)}
                      />
                      <span>
                        <strong>{formatPermissionTitle(def.code)}</strong>
                        <small>{def.actionLabel}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
