"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useAdminEmployees,
  useAdminRoles,
  useCreateEmployee,
  useUpdateEmployee,
} from "@/hooks/use-admin-roles";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import type { AdminEmployeeRow } from "@/lib/types/api";

type FormState = {
  name: string;
  email: string;
  roleCode: string;
  password: string;
  active: boolean;
};

const emptyForm = (roleCode: string = ROLE_CODES.SKETCH_DESIGNER): FormState => ({
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

  const roles = rolesQuery.data ?? [];
  const currentEmployeeId = session?.user?.employeeId;
  const defaultRoleCode = roles[0]?.code ?? ROLE_CODES.SKETCH_DESIGNER;

  function openCreateModal() {
    setCreateForm(emptyForm(defaultRoleCode));
    setCreateOpen(true);
  }

  function openEditModal(employee: AdminEmployeeRow) {
    setEditEmployee(employee);
    setEditForm({
      name: employee.name,
      email: employee.email,
      roleCode: employee.role.code,
      password: "",
      active: employee.active,
    });
  }

  async function handleCreateSubmit() {
    await createEmployee.mutateAsync({
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
          <AppButton type="button" appVariant="primary" onClick={openCreateModal}>
            Add Employee
          </AppButton>
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
        <AppCard>
          <DataTable
            columns={[
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
                    <AppButton
                      type="button"
                      appVariant="ghost"
                      size="sm"
                      onClick={() => openEditModal(row)}
                    >
                      Edit
                    </AppButton>
                    {!isSelf(row.id) && (
                      <AppButton
                        type="button"
                        appVariant="secondary"
                        size="sm"
                        disabled={updateEmployee.isPending}
                        onClick={() => toggleActive(row)}
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </AppButton>
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
              <AppButton type="button" appVariant="primary" onClick={openCreateModal}>
                Add Employee
              </AppButton>
            }
          />

          <p className="role-admin-note">
            New users sign in with their email and the password you set. Role and permission changes
            apply on their next login. Your own System Admin account cannot be deactivated or
            demoted.
          </p>
        </AppCard>
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
      description={
        requirePassword
          ? "Create a new employee account with login credentials."
          : "Update employee details and access settings."
      }
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            disabled={!canSubmit || isPending}
            onClick={onSubmit}
          >
            {isPending ? "Saving…" : submitLabel}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <FormSelect
          id="empRole"
          label="Role"
          required
          value={form.roleCode || null}
          onValueChange={(v) => onChange({ ...form, roleCode: v })}
          options={roles.map((role) => ({
            value: role.code,
            label: role.displayName,
          }))}
        />

        <FormTextField
          id="empName"
          label="Full Name"
          required
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Employee name"
        />

        <FormTextField
          id="empEmail"
          label="Email (login)"
          required
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          placeholder="name@decent-erp.local"
        />

        <FormTextField
          id="empPassword"
          label={requirePassword ? "Password" : "New Password"}
          required={requirePassword}
          type="password"
          value={form.password}
          onChange={(e) => onChange({ ...form, password: e.target.value })}
          placeholder={requirePassword ? "Minimum 8 characters" : "Leave blank to keep current"}
          autoComplete="new-password"
          hint={!requirePassword ? "Role changes from this form also apply on next login." : undefined}
        />

        {showActiveToggle && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={form.active}
              onChange={(e) => onChange({ ...form, active: e.target.checked })}
            />
            <span>Account is active (can sign in)</span>
          </label>
        )}
      </ModalForm>
    </Modal>
  );
}
