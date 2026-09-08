"use client";

import Link from "next/link";
import { AppCard } from "@/components/ui/AppCard";
import { AppButtonLink } from "@/components/ui/AppButton";
import { FormSelect } from "@/components/ui/form-select";
import { QueryState } from "@/components/ui/QueryState";
import {
  useAdminEmployees,
  useAdminRoles,
  useUpdateEmployee,
} from "@/hooks/use-admin-roles";
import { formatRoleLabel, getRoleDefinition } from "@/config/roles";
import {
  formatPermissionTitle,
  listPermissionsByGroup,
} from "@/lib/permission-catalog";
import { ROUTES } from "@/config/routes";

/**
 * Step 1 of Roles & Access: map each role to the people (user names) who hold it,
 * then change role assignment inline before editing the permission matrix.
 */
export function RbacPeopleStep({ onContinue }: { onContinue: () => void }) {
  const rolesQuery = useAdminRoles();
  const employeesQuery = useAdminEmployees();
  const updateEmployee = useUpdateEmployee();

  const roles = rolesQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const roleOptions = roles.map((r) => ({
    value: r.code,
    label: r.displayName || formatRoleLabel(r.code),
  }));

  const byRole = new Map<string, typeof employees>();
  for (const role of roles) {
    byRole.set(
      role.code,
      employees.filter((e) => e.role.code === role.code && e.active),
    );
  }

  return (
    <div className="rbac-people-step space-y-4">
      <div className="rbac-step-intro">
        <p>
          Start with <strong>who</strong> has each role. Access is granted to the role, then
          inherited by every person listed under it. Next step sets the permission columns.
        </p>
        <div className="flex flex-wrap gap-2">
          <AppButtonLink href={ROUTES.admin.employees} appVariant="outline" size="sm">
            Open Employees
          </AppButtonLink>
          <button type="button" className="rbac-step-continue" onClick={onContinue}>
            Continue to permissions →
          </button>
        </div>
      </div>

      <QueryState
        isLoading={rolesQuery.isLoading || employeesQuery.isLoading}
        isError={rolesQuery.isError || employeesQuery.isError}
        error={rolesQuery.error ?? employeesQuery.error}
        onRetry={() => {
          void rolesQuery.refetch();
          void employeesQuery.refetch();
        }}
      >
        <div className="rbac-people-grid">
          {roles.map((role) => {
            const catalog = getRoleDefinition(role.code);
            const people = byRole.get(role.code) ?? [];
            const defaultPerms = catalog?.permissions ?? [];

            return (
              <AppCard key={role.id} className="rbac-people-card" title={role.displayName}>
                <div className="rbac-people-card-meta">
                  <code className="role-code-tag">{role.code}</code>
                  <span className="text-xs text-muted-foreground">
                    {people.length} person{people.length === 1 ? "" : "s"} ·{" "}
                    {role.permissionCount} permissions
                  </span>
                </div>
                {catalog?.summary ? (
                  <p className="rbac-people-summary">{catalog.summary}</p>
                ) : null}

                <h4 className="rbac-people-subtitle">People</h4>
                {people.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active employees in this role.</p>
                ) : (
                  <ul className="rbac-people-list">
                    {people.map((person) => (
                      <li key={person.id} className="rbac-people-row">
                        <div className="min-w-0">
                          <p className="rbac-people-name">{person.name}</p>
                          <p className="rbac-people-sub">
                            {person.employeeCode}
                            {person.email ? ` · ${person.email}` : ""}
                          </p>
                        </div>
                        <FormSelect
                          id={`role-${person.id}`}
                          value={person.role.code}
                          onValueChange={(code) => {
                            if (code === person.role.code) return;
                            updateEmployee.mutate({
                              employeeId: person.id,
                              roleCode: code,
                            });
                          }}
                          options={roleOptions}
                          disabled={updateEmployee.isPending}
                          className="rbac-people-role-select"
                          placeholder="Role"
                        />
                      </li>
                    ))}
                  </ul>
                )}

                <h4 className="rbac-people-subtitle">Default permissions</h4>
                <div className="rbac-people-perm-chips">
                  {listPermissionsByGroup().flatMap((g) =>
                    g.permissions
                      .filter((p) => defaultPerms.includes(p.code))
                      .map((p) => (
                        <span key={p.code} className="rbac-perm-chip" title={p.description}>
                          {formatPermissionTitle(p.code)}
                        </span>
                      )),
                  )}
                  {defaultPerms.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None</span>
                  ) : null}
                </div>
              </AppCard>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          Need a new login?{" "}
          <Link href={ROUTES.admin.employees} className="underline underline-offset-2">
            Create them under Employees
          </Link>
          , then return here to confirm role → permissions.
        </p>
      </QueryState>
    </div>
  );
}
