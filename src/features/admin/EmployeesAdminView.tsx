"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useAdminEmployees,
  useAdminRoles,
  useCreateEmployee,
  useSuggestedEmployeeCode,
  useUpdateEmployee,
} from "@/hooks/use-admin-roles";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import type { AdminEmployeeRow } from "@/lib/types/api";

type FormState = {
  employeeCode: string;
  name: string;
  email: string;
  roleCode: string;
  password: string;
  active: boolean;
};

const emptyForm = (roleCode: string = ROLE_CODES.SKETCH_DESIGNER): FormState => ({
  employeeCode: "",
  name: "",
  email: "",
  roleCode,
  password: "",
  active: true,
});

export function EmployeesAdminView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canManage = permissions.includes(PERMISSIONS.MASTER_ADMIN);

  const employeesQuery = useAdminEmployees(canManage);
  const rolesQuery = useAdminRoles(canManage);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<AdminEmployeeRow | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(() => emptyForm());
  const [editForm, setEditForm] = useState<FormState>(() => emptyForm());

  const suggestCodeQuery = useSuggestedEmployeeCode(createOpen);
  const roles = rolesQuery.data ?? [];
  const currentEmployeeId = session?.user?.employeeId;
  const defaultRoleCode = roles[0]?.code ?? ROLE_CODES.SKETCH_DESIGNER;

  useEffect(() => {
    if (createOpen && suggestCodeQuery.data?.employeeCode) {
      setCreateForm((prev) => ({
        ...prev,
        employeeCode: suggestCodeQuery.data!.employeeCode,
        roleCode: prev.roleCode || defaultRoleCode,
      }));
    }
  }, [createOpen, suggestCodeQuery.data, defaultRoleCode]);

  function openCreateModal() {
    setCreateForm(emptyForm(defaultRoleCode));
    setCreateOpen(true);
  }

  function openEditModal(employee: AdminEmployeeRow) {
    setEditEmployee(employee);
    setEditForm({
      employeeCode: employee.employeeCode,
      name: employee.name,
      email: employee.email,
      roleCode: employee.role.code,
      password: "",
      active: employee.active,
    });
  }

  async function handleCreateSubmit() {
    await createEmployee.mutateAsync({
      employeeCode: createForm.employeeCode.trim() || undefined,
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      roleCode: createForm.roleCode,
      password: createForm.password,
    });
    setCreateOpen(false);
  }

  async function handleEditSubmit() {
    if (!editEmployee) return;

    const payload: {
      name: string;
      email: string;
      roleCode: string;
      active: boolean;
      password?: string;
    } = {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      roleCode: editForm.roleCode,
      active: editForm.active,
    };

    if (editForm.password.trim()) {
      payload.password = editForm.password;
    }

    await updateEmployee.mutateAsync({ employeeId: editEmployee.id, ...payload });
    setEditEmployee(null);
  }

  async function handleRoleChange(employee: AdminEmployeeRow, roleCode: string) {
    if (employee.role.code === roleCode) return;
    await updateEmployee.mutateAsync({ employeeId: employee.id, roleCode });
  }

  async function toggleActive(employee: AdminEmployeeRow) {
    await updateEmployee.mutateAsync({
      employeeId: employee.id,
      active: !employee.active,
    });
  }

  const isSelf = (id: number) => id === currentEmployeeId;

  if (!canManage) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Employees"
        subtitle="Create accounts, assign roles, reset passwords, and activate or deactivate users"
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            Add Employee
          </button>
        }
      />

      <QueryState
        isLoading={employeesQuery.isLoading || rolesQuery.isLoading}
        isError={employeesQuery.isError || rolesQuery.isError}
        error={employeesQuery.error ?? rolesQuery.error}
        onRetry={() => {
          employeesQuery.refetch();
          rolesQuery.refetch();
        }}
        skeletonVariant="table"
      >
        <div className="card">
          <DataTable
            columns={[
              { key: "employeeCode", header: "Code" },
              { key: "name", header: "Name" },
              { key: "email", header: "Email" },
              {
                key: "role",
                header: "Role",
                render: (row) => (
                  <select
                    className="form-select form-select--compact"
                    value={row.role.code}
                    disabled={updateEmployee.isPending || isSelf(row.id)}
                    onChange={(e) => handleRoleChange(row, e.target.value)}
                    aria-label={`Role for ${row.name}`}
                  >
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.displayName}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "active",
                header: "Status",
                render: (row) => (
                  <StatusBadge
                    status={row.active ? "ACTIVE" : "INACTIVE"}
                    label={row.active ? "Active" : "Inactive"}
                  />
                ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => (
                  <div className="table-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEditModal(row)}
                    >
                      Edit
                    </button>
                    {!isSelf(row.id) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={updateEmployee.isPending}
                        onClick={() => toggleActive(row)}
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={employeesQuery.data ?? []}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No employees yet"
            emptyDescription="Add your first employee to give them login access and a role."
            emptyAction={
              <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                Add Employee
              </button>
            }
          />

          <p className="role-admin-note">
            New users sign in with their email and the password you set. Role and permission changes
            apply on their next login. Your own System Admin account cannot be deactivated or
            demoted.
          </p>
        </div>
      </QueryState>

      <EmployeeFormModal
        open={createOpen}
        title="Add Employee"
        form={createForm}
        roles={roles}
        requirePassword
        isPending={createEmployee.isPending}
        onClose={() => setCreateOpen(false)}
        onChange={setCreateForm}
        onSubmit={handleCreateSubmit}
        submitLabel="Create Employee"
      />

      <EmployeeFormModal
        open={!!editEmployee}
        title={editEmployee ? `Edit ${editEmployee.name}` : "Edit Employee"}
        form={editForm}
        roles={roles}
        codeReadOnly
        showActiveToggle={!!editEmployee && !isSelf(editEmployee.id)}
        requirePassword={false}
        isPending={updateEmployee.isPending}
        onClose={() => setEditEmployee(null)}
        onChange={setEditForm}
        onSubmit={handleEditSubmit}
        submitLabel="Save Changes"
      />
    </div>
  );
}

type EmployeeFormModalProps = {
  open: boolean;
  title: string;
  form: FormState;
  roles: Array<{ code: string; displayName: string }>;
  requirePassword: boolean;
  codeReadOnly?: boolean;
  showActiveToggle?: boolean;
  isPending: boolean;
  onClose: () => void;
  onChange: (form: FormState) => void;
  onSubmit: () => void;
  submitLabel: string;
};

function EmployeeFormModal({
  open,
  title,
  form,
  roles,
  requirePassword,
  codeReadOnly,
  showActiveToggle,
  isPending,
  onClose,
  onChange,
  onSubmit,
  submitLabel,
}: EmployeeFormModalProps) {
  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    form.roleCode &&
    (requirePassword ? form.password.length >= 8 : true);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit || isPending}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <div className="form-grid form-grid--2">
        <div className="form-group">
          <label className="form-label" htmlFor="empCode">
            Employee Code
          </label>
          <input
            id="empCode"
            className="form-input"
            value={form.employeeCode}
            readOnly={codeReadOnly}
            onChange={(e) => onChange({ ...form, employeeCode: e.target.value.toUpperCase() })}
            placeholder="EMP010"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="empRole">
            Role *
          </label>
          <select
            id="empRole"
            className="form-select"
            value={form.roleCode}
            onChange={(e) => onChange({ ...form, roleCode: e.target.value })}
          >
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="empName">
          Full Name *
        </label>
        <input
          id="empName"
          className="form-input"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Employee name"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="empEmail">
          Email (login) *
        </label>
        <input
          id="empEmail"
          type="email"
          className="form-input"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          placeholder="name@decent-erp.local"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="empPassword">
          {requirePassword ? "Password *" : "New Password"}
        </label>
        <input
          id="empPassword"
          type="password"
          className="form-input"
          value={form.password}
          onChange={(e) => onChange({ ...form, password: e.target.value })}
          placeholder={requirePassword ? "Minimum 8 characters" : "Leave blank to keep current"}
          autoComplete="new-password"
        />
      </div>

      {showActiveToggle && (
        <label className="form-checkbox-row">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => onChange({ ...form, active: e.target.checked })}
          />
          <span>Account is active (can sign in)</span>
        </label>
      )}

      {!requirePassword && (
        <p className="form-hint">Role changes from this form also apply on next login.</p>
      )}
    </Modal>
  );
}
