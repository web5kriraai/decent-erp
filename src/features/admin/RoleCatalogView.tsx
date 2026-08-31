"use client";

import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { RolePermissionEditor } from "@/features/admin/RolePermissionEditor";
import { useAdminRoles } from "@/hooks/use-admin-roles";
import { ROLE_CATALOG, formatRoleLabel, getRoleDefinition } from "@/config/roles";

export function RoleCatalogList() {
  const rolesQuery = useAdminRoles();
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

  return (
    <QueryState
      isLoading={rolesQuery.isLoading}
      isError={rolesQuery.isError}
      error={rolesQuery.error}
      onRetry={() => rolesQuery.refetch()}
    >
      <div className="role-catalog">
        {(rolesQuery.data ?? []).map((role) => {
          const catalog = getRoleDefinition(role.code) ?? ROLE_CATALOG[role.code as keyof typeof ROLE_CATALOG];
          const isEditing = editingRoleId === role.id;

          return (
            <article key={role.id} className="card role-catalog-item">
              <header className="role-catalog-header">
                <h2>{catalog?.displayName ?? role.name}</h2>
                <code className="role-code-tag">{role.code}</code>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => setEditingRoleId(isEditing ? null : role.id)}
                >
                  {isEditing ? "Close editor" : "Edit permissions"}
                </button>
              </header>

              {catalog && (
                <>
                  <p className="role-catalog-summary">{catalog.summary}</p>
                  <div className="role-catalog-columns">
                    <div>
                      <h4>Responsibilities</h4>
                      <ul>
                        {catalog.responsibilities.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Restrictions</h4>
                      <ul>
                        {catalog.restrictions.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Assigned ({role.permissionCount})</h4>
                      <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>
                        {role.employeeCount} active employee{role.employeeCount === 1 ? "" : "s"}
                      </p>
                      <h4 style={{ marginTop: "1rem" }}>Sidebar modules</h4>
                      <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>
                        {catalog.navFocus.join(", ")}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {isEditing && (
                <RolePermissionEditor
                  roleId={role.id}
                  roleCode={role.code}
                  roleName={catalog?.displayName ?? formatRoleLabel(role.code)}
                />
              )}
            </article>
          );
        })}
      </div>
    </QueryState>
  );
}

export { formatRoleLabel, getRoleDefinition };
