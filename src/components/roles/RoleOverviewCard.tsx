"use client";

import { formatRoleLabel, getRoleDefinition } from "@/config/roles";
import { ROLE_CODES } from "@/lib/permissions";

type RoleOverviewCardProps = {
  roleCode: string;
  permissions: string[];
};

export function RoleOverviewCard({ roleCode, permissions }: RoleOverviewCardProps) {
  const role = getRoleDefinition(roleCode);
  if (!role) return null;

  return (
    <div className="card card--flat role-overview-card">
      <div className="card-header" style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem" }}>
        <div>
          <span className="card-title">{role.displayName}</span>
          <p className="page-header-subtitle" style={{ marginTop: "0.25rem" }}>
            {role.summary}
          </p>
        </div>
        <span className="badge" style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
          {formatRoleLabel(roleCode)}
        </span>
      </div>

      <div className="role-overview-grid">
        <div>
          <h3 className="role-overview-heading">Your responsibilities</h3>
          <ul className="role-overview-list">
            {role.responsibilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="role-overview-heading">Access in this session</h3>
          <div className="role-perm-chips">
            {(roleCode === ROLE_CODES.ADMIN
              ? permissions
              : role.permissions.filter((p) => permissions.includes(p))
            ).map((p) => (
              <span key={p} className="role-perm-chip">
                {p.replace(/_/g, " ")}
              </span>
            ))}
          </div>
          <h3 className="role-overview-heading" style={{ marginTop: "1rem" }}>
            Sidebar modules
          </h3>
          <p style={{ margin: 0, color: "var(--color-neutral-600)", fontSize: "var(--font-size-body)" }}>
            {role.navFocus.join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}
