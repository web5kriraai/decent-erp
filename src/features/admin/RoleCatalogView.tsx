"use client";

import { ROLE_CATALOG, formatRoleLabel, getRoleDefinition } from "@/config/roles";

export function RoleCatalogList() {
  const roles = Object.values(ROLE_CATALOG);

  return (
    <div className="role-catalog">
      {roles.map((role) => (
        <article key={role.code} className="card role-catalog-item">
          <header className="role-catalog-header">
            <h2>{role.displayName}</h2>
            <code className="role-code-tag">{role.code}</code>
          </header>
          <p className="role-catalog-summary">{role.summary}</p>
          <div className="role-catalog-columns">
            <div>
              <h4>Responsibilities</h4>
              <ul>
                {role.responsibilities.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Restrictions</h4>
              <ul>
                {role.restrictions.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Permissions</h4>
              <div className="role-perm-chips">
                {role.permissions.map((p) => (
                  <span key={p} className="role-perm-chip">
                    {p.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              <h4 style={{ marginTop: "1rem" }}>Sidebar modules</h4>
              <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>
                {role.navFocus.join(", ")}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export { formatRoleLabel, getRoleDefinition };
