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
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
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
                key: "grade",
                header: "Grade",
                render: (row) =>
                  row.gradeCode ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={
                          row.gradeCode === "A"
                            ? "APPROVED"
                            : row.gradeCode === "B"
                              ? "COMPLETED"
                              : row.gradeCode === "C"
                                ? "ASSIGNED"
                                : row.gradeCode === "D"
                                  ? "ON_HOLD"
                                  : "REJECTED"
                        }
                        label={`Grade ${row.gradeCode}`}
                      />
                      {row.marksBalance != null ? (
                        <span className="text-sm text-muted-foreground">
                          {Math.round(row.marksBalance * 10) / 10} marks
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
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
                  <TableIconActionGroup>
                    <TableIconAction action="edit" onClick={() => openEditModal(row)} />
                    {!isSelf(row.id) && (
                      <TableIconAction
                        action={row.active ? "deactivate" : "activate"}
                        disabled={updateEmployee.isPending}
                        onClick={() => toggleActive(row)}
                      />
                    )}
                  </TableIconActionGroup>
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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const fieldErrors = {
    roleCode: !form.roleCode ? "Role is required" : undefined,
    name:
      form.name.trim().length < 2 ? "Full name must be at least 2 characters" : undefined,
    email: !form.email.trim() ? "Email is required" : undefined,
    password:
      requirePassword && form.password.length < 8
        ? "Password must be at least 8 characters"
        : undefined,
  };

  const canSubmit =
    !fieldErrors.roleCode &&
    !fieldErrors.name &&
    !fieldErrors.email &&
    !fieldErrors.password;

  function handleSubmit() {
    setAttemptedSubmit(true);
    if (!canSubmit || isPending) return;
    onSubmit();
  }

  function handleClose() {
    setAttemptedSubmit(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={handleClose}
      size="lg"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={handleClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
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
          error={attemptedSubmit ? fieldErrors.roleCode : undefined}
        />

        <FormTextField
          id="empName"
          label="Full Name"
          required
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Employee name"
          error={attemptedSubmit ? fieldErrors.name : undefined}
        />

        <FormTextField
          id="empEmail"
          label="Email (login)"
          required
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          placeholder="name@decent-erp.local"
          error={attemptedSubmit ? fieldErrors.email : undefined}
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
          error={attemptedSubmit ? fieldErrors.password : undefined}
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
