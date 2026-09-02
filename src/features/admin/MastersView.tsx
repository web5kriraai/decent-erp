"use client";

import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import {
  Modal,
  ModalAlert,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { PERMISSIONS } from "@/lib/permissions";
import { useProcessMasters } from "@/hooks/use-masters";
import { useAdminRoles } from "@/hooks/use-admin-roles";
import { apiPost, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";

export function MastersView({ embedded = false }: { embedded?: boolean }) {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const processesQuery = useProcessMasters(enabled, true);
  const rolesQuery = useAdminRoles(enabled);
  const queryClient = useQueryClient();
  const toast = useApiToast();

  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [subProcessModalOpen, setSubProcessModalOpen] = useState(false);
  const [expandedProcessId, setExpandedProcessId] = useState<number | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sequence, setSequence] = useState("1");

  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [subSequence, setSubSequence] = useState("1");
  const [defaultRoleId, setDefaultRoleId] = useState<number | "">("");

  const [editProcess, setEditProcess] = useState<{
    id: number;
    name: string;
    sequence: string;
    active: boolean;
  } | null>(null);

  const [editSubProcess, setEditSubProcess] = useState<{
    id: number;
    name: string;
    sequence: string;
    defaultRoleId: number | "";
    active: boolean;
  } | null>(null);

  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    warning?: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const roles = rolesQuery.data ?? [];
  const roleNameById = new Map(roles.map((role) => [role.id, role.displayName]));

  const createProcess = useMutation({
    mutationFn: () =>
      apiPost("/api/masters/processes", {
        code: code.toUpperCase(),
        name,
        sequence: Number(sequence),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      toast.success("Process created");
      setProcessModalOpen(false);
      setCode("");
      setName("");
    },
    onError: (error) => toast.errorFromApi(error, "Could not create process"),
  });

  const createSubProcess = useMutation({
    mutationFn: () =>
      apiPost(`/api/masters/processes/${selectedProcessId}/sub-processes`, {
        code: subCode.toUpperCase(),
        name: subName,
        sequence: Number(subSequence),
        defaultRoleId: defaultRoleId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      toast.success("Sub-process created");
      setSubProcessModalOpen(false);
      setSubCode("");
      setSubName("");
      setSubSequence("1");
      setDefaultRoleId("");
    },
    onError: (error) => toast.errorFromApi(error, "Could not create sub-process"),
  });

  const updateProcess = useMutation({
    mutationFn: (payload: { id: number; name: string; sequence: number; active: boolean }) =>
      apiPatch<{
        id: number;
        warnings?: Array<{ code: string; message: string; count: number }>;
      }>(`/api/masters/processes/${payload.id}`, {
        name: payload.name,
        sequence: payload.sequence,
        active: payload.active,
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      const warnings = data.warnings ?? [];
      if (!variables.active && warnings.length > 0) {
        toast.warning(
          "Process deactivated",
          warnings.map((w) => w.message).join("; "),
        );
      } else {
        toast.success(variables.active ? "Process updated" : "Process deactivated");
      }
      setEditProcess(null);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update process"),
  });

  const updateSubProcess = useMutation({
    mutationFn: (payload: {
      id: number;
      name: string;
      sequence: number;
      defaultRoleId: number | null;
      active: boolean;
    }) =>
      apiPatch<{
        id: number;
        warnings?: Array<{ code: string; message: string; count: number }>;
      }>(`/api/masters/sub-processes/${payload.id}`, {
        name: payload.name,
        sequence: payload.sequence,
        defaultRoleId: payload.defaultRoleId,
        active: payload.active,
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      const warnings = data.warnings ?? [];
      if (!variables.active && warnings.length > 0) {
        toast.warning(
          "Sub-process deactivated",
          warnings.map((w) => w.message).join("; "),
        );
      } else {
        toast.success(variables.active ? "Sub-process updated" : "Sub-process deactivated");
      }
      setEditSubProcess(null);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update sub-process"),
  });

  const setProcessActive = useMutation({
    mutationFn: (payload: { id: number; active: boolean; name: string; sequence: number }) =>
      apiPatch<{
        id: number;
        warnings?: Array<{ code: string; message: string; count: number }>;
      }>(`/api/masters/processes/${payload.id}`, {
        name: payload.name,
        sequence: payload.sequence,
        active: payload.active,
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      const warnings = data.warnings ?? [];
      if (!variables.active && warnings.length > 0) {
        toast.warning(
          "Process deactivated",
          warnings.map((w) => w.message).join("; "),
        );
      } else if (variables.active) {
        toast.success("Process reactivated");
      } else {
        toast.success("Process deactivated");
      }
    },
    onError: (error) => toast.errorFromApi(error, "Could not update process status"),
  });

  const setSubProcessActive = useMutation({
    mutationFn: (payload: {
      id: number;
      active: boolean;
      name: string;
      sequence: number;
      defaultRoleId: number | null;
    }) =>
      apiPatch<{
        id: number;
        warnings?: Array<{ code: string; message: string; count: number }>;
      }>(`/api/masters/sub-processes/${payload.id}`, {
        name: payload.name,
        sequence: payload.sequence,
        defaultRoleId: payload.defaultRoleId,
        active: payload.active,
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      const warnings = data.warnings ?? [];
      if (!variables.active && warnings.length > 0) {
        toast.warning(
          "Sub-process deactivated",
          warnings.map((w) => w.message).join("; "),
        );
      } else if (variables.active) {
        toast.success("Sub-process reactivated");
      } else {
        toast.success("Sub-process deactivated");
      }
    },
    onError: (error) => toast.errorFromApi(error, "Could not update sub-process status"),
  });

  function confirmDeactivateProcess(process: {
    id: number;
    name: string;
    sequence: number;
    subProcesses?: Array<{ active?: boolean }>;
  }) {
    const activeChildren = (process.subProcesses ?? []).filter((s) => s.active !== false).length;
    setPendingConfirm({
      title: `Deactivate "${process.name}"?`,
      description:
        "It will be hidden from new designs and workflows. Existing tasks keep their history.",
      warning:
        activeChildren > 0
          ? `${activeChildren} active sub-process${activeChildren === 1 ? "" : "es"} will also be deactivated.`
          : undefined,
      confirmLabel: "Deactivate",
      onConfirm: () => {
        setProcessActive.mutate(
          {
            id: process.id,
            active: false,
            name: process.name,
            sequence: process.sequence,
          },
          { onSuccess: () => setPendingConfirm(null) },
        );
      },
    });
  }

  function confirmDeactivateSubProcess(sub: {
    id: number;
    name: string;
    sequence: number;
    defaultRoleId?: number | null;
  }) {
    setPendingConfirm({
      title: `Deactivate "${sub.name}"?`,
      description: "It will be hidden from new work. Existing tasks keep their history.",
      confirmLabel: "Deactivate",
      onConfirm: () => {
        setSubProcessActive.mutate(
          {
            id: sub.id,
            active: false,
            name: sub.name,
            sequence: sub.sequence,
            defaultRoleId: sub.defaultRoleId ?? null,
          },
          { onSuccess: () => setPendingConfirm(null) },
        );
      },
    });
  }

  function confirmDeactivateProcessFromEdit(edit: {
    id: number;
    name: string;
    sequence: string;
    active: boolean;
  }) {
    const processRow = processes.find((p) => p.id === edit.id);
    const activeChildren = (processRow?.subProcesses ?? []).filter(
      (s) => (s as { active?: boolean }).active !== false,
    ).length;
    setPendingConfirm({
      title: `Deactivate "${edit.name}"?`,
      description:
        "It will be hidden from new designs and workflows. Existing tasks keep their history.",
      warning:
        activeChildren > 0
          ? `${activeChildren} active sub-process${activeChildren === 1 ? "" : "es"} will also be deactivated.`
          : undefined,
      confirmLabel: "Deactivate",
      onConfirm: () => {
        updateProcess.mutate(
          {
            id: edit.id,
            name: edit.name,
            sequence: Number(edit.sequence) || 1,
            active: false,
          },
          {
            onSuccess: () => {
              setPendingConfirm(null);
              setEditProcess(null);
            },
          },
        );
      },
    });
  }

  function confirmDeactivateSubProcessFromEdit(edit: {
    id: number;
    name: string;
    sequence: string;
    defaultRoleId: number | "";
    active: boolean;
  }) {
    setPendingConfirm({
      title: `Deactivate "${edit.name}"?`,
      description: "It will be hidden from new work. Existing tasks keep their history.",
      confirmLabel: "Deactivate",
      onConfirm: () => {
        updateSubProcess.mutate(
          {
            id: edit.id,
            name: edit.name,
            sequence: Number(edit.sequence) || 1,
            defaultRoleId: edit.defaultRoleId === "" ? null : edit.defaultRoleId,
            active: false,
          },
          {
            onSuccess: () => {
              setPendingConfirm(null);
              setEditSubProcess(null);
            },
          },
        );
      },
    });
  }

  function openSubProcessModal(processId: number, nextSequence: number) {
    setSelectedProcessId(processId);
    setSubSequence(String(nextSequence));
    setSubProcessModalOpen(true);
  }

  function toggleExpanded(processId: number) {
    setExpandedProcessId((current) => (current === processId ? null : processId));
  }

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  const processes = processesQuery.data ?? [];

  return (
    <>
      {!embedded ? (
        <div className="page-shell">
          <PageHeader
            title="Process Masters"
            subtitle="Main processes and sub-processes. Deactivate to retire from new work (soft delete); inactive rows stay visible here for reactivation."
            actions={
              <AppButton
                type="button"
                appVariant="primary"
                size="sm"
                onClick={() => setProcessModalOpen(true)}
              >
                Add Process
              </AppButton>
            }
          />
          {renderContent()}
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              onClick={() => setProcessModalOpen(true)}
            >
              Add Process
            </AppButton>
          </div>
          {renderContent()}
        </>
      )}

      {renderModals()}
    </>
  );

  function renderContent() {
    return (
      <QueryState
        isLoading={processesQuery.isLoading}
        isError={processesQuery.isError}
        error={processesQuery.error}
        onRetry={() => processesQuery.refetch()}
        skeletonVariant="table"
      >
        <AppCard>
          <div className="data-table-wrap">
            {processes.length === 0 ? (
              <p className="text-muted-inline">
                No process masters configured. Seed workflow patterns and process masters to enable
                task generation.
              </p>
            ) : (
              <div className="scroll-x-region">
                <table className="data-table app-table">
                  <thead>
                    <tr>
                      <th className="w-10" aria-label="Expand" />
                      <th className="text-center">#</th>
                      <th>Code</th>
                      <th>Process Name</th>
                      <th>Sub-processes</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((process) => {
                      const isExpanded = expandedProcessId === process.id;
                      const subProcesses = process.subProcesses ?? [];
                      const isActive = (process as { active?: boolean }).active !== false;

                      return (
                        <Fragment key={process.id}>
                          <tr>
                            <td>
                              <AppButton
                                type="button"
                                appVariant="ghost"
                                size="sm"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? "Collapse sub-processes" : "Expand sub-processes"}
                                onClick={() => toggleExpanded(process.id)}
                              >
                                {isExpanded ? "▾" : "▸"}
                              </AppButton>
                            </td>
                            <td className="text-center">{process.sequence}</td>
                            <td>{process.code}</td>
                            <td>{process.name}</td>
                            <td>{subProcesses.length}</td>
                            <td>
                              <StatusBadge
                                status={isActive ? "ACTIVE" : "CLOSED"}
                                label={isActive ? "Active" : "Inactive"}
                              />
                            </td>
                            <td className="text-right">
                              <TableIconActionGroup>
                                <TableIconAction
                                  action="edit"
                                  onClick={() =>
                                    setEditProcess({
                                      id: process.id,
                                      name: process.name,
                                      sequence: String(process.sequence),
                                      active: isActive,
                                    })
                                  }
                                />
                                {isActive ? (
                                  <>
                                    <TableIconAction
                                      action="add"
                                      label="Add sub-process"
                                      onClick={() =>
                                        openSubProcessModal(process.id, subProcesses.length + 1)
                                      }
                                    />
                                    <TableIconAction
                                      action="deactivate"
                                      disabled={setProcessActive.isPending}
                                      onClick={() =>
                                        confirmDeactivateProcess({
                                          id: process.id,
                                          name: process.name,
                                          sequence: process.sequence,
                                          subProcesses,
                                        })
                                      }
                                    />
                                  </>
                                ) : (
                                  <TableIconAction
                                    action="reactivate"
                                    disabled={setProcessActive.isPending}
                                    onClick={() =>
                                      setProcessActive.mutate({
                                        id: process.id,
                                        active: true,
                                        name: process.name,
                                        sequence: process.sequence,
                                      })
                                    }
                                  />
                                )}
                              </TableIconActionGroup>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="bg-[var(--color-neutral-50)] px-4 py-3">
                                {subProcesses.length === 0 ? (
                                  <p className="text-muted-inline">
                                    No sub-processes configured for this process.
                                  </p>
                                ) : (
                                  <table className="data-table app-table m-0">
                                    <thead>
                                      <tr>
                                        <th className="text-center">#</th>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Default Role</th>
                                        <th>Status</th>
                                        <th className="text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subProcesses.map((sub) => {
                                        const subActive = (sub as { active?: boolean }).active !== false;
                                        return (
                                        <tr key={sub.id}>
                                          <td className="text-center">{sub.sequence}</td>
                                          <td>{sub.code}</td>
                                          <td>{sub.name}</td>
                                          <td>
                                            {sub.defaultRoleId
                                              ? (roleNameById.get(sub.defaultRoleId) ??
                                                `Role #${sub.defaultRoleId}`)
                                              : "—"}
                                          </td>
                                          <td>
                                            <StatusBadge
                                              status={subActive ? "ACTIVE" : "CLOSED"}
                                              label={subActive ? "Active" : "Inactive"}
                                            />
                                          </td>
                                          <td className="text-right">
                                            <TableIconActionGroup>
                                              <TableIconAction
                                                action="edit"
                                                onClick={() =>
                                                  setEditSubProcess({
                                                    id: sub.id,
                                                    name: sub.name,
                                                    sequence: String(sub.sequence),
                                                    defaultRoleId: sub.defaultRoleId ?? "",
                                                    active: subActive,
                                                  })
                                                }
                                              />
                                              {subActive ? (
                                                <TableIconAction
                                                  action="deactivate"
                                                  disabled={setSubProcessActive.isPending}
                                                  onClick={() =>
                                                    confirmDeactivateSubProcess({
                                                      id: sub.id,
                                                      name: sub.name,
                                                      sequence: sub.sequence,
                                                      defaultRoleId: sub.defaultRoleId,
                                                    })
                                                  }
                                                />
                                              ) : (
                                                <TableIconAction
                                                  action="reactivate"
                                                  disabled={setSubProcessActive.isPending}
                                                  onClick={() =>
                                                    setSubProcessActive.mutate({
                                                      id: sub.id,
                                                      active: true,
                                                      name: sub.name,
                                                      sequence: sub.sequence,
                                                      defaultRoleId: sub.defaultRoleId ?? null,
                                                    })
                                                  }
                                                />
                                              )}
                                            </TableIconActionGroup>
                                          </td>
                                        </tr>
                                      );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </AppCard>
      </QueryState>
    );
  }

  function renderModals() {
    return (
      <>
      <Modal
        open={processModalOpen}
        title="Add Process"
        description="Create a new top-level process for workflow patterns and task routing."
        onClose={() => setProcessModalOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={() => setProcessModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={!code || !name || createProcess.isPending}
              onClick={() => createProcess.mutate()}
            >
              {createProcess.isPending ? "Creating…" : "Create"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormTextField
            id="procCode"
            label="Code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <FormTextField
            id="procName"
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormTextField
            id="procSeq"
            label="Sequence"
            type="number"
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
          />
        </ModalForm>
      </Modal>

      <Modal
        open={!!editProcess}
        title="Edit Process"
        onClose={() => setEditProcess(null)}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={() => setEditProcess(null)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={!editProcess?.name || updateProcess.isPending}
              onClick={() => {
                if (!editProcess) return;
                const processRow = processes.find((p) => p.id === editProcess.id);
                const wasActive = processRow
                  ? (processRow as { active?: boolean }).active !== false
                  : true;
                if (wasActive && !editProcess.active) {
                  confirmDeactivateProcessFromEdit(editProcess);
                  return;
                }
                updateProcess.mutate(
                  {
                    id: editProcess.id,
                    name: editProcess.name,
                    sequence: Number(editProcess.sequence) || 1,
                    active: editProcess.active,
                  },
                  { onSuccess: () => setEditProcess(null) },
                );
              }}
            >
              {updateProcess.isPending ? "Saving…" : "Save"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        {editProcess ? (
          <ModalForm>
            <FormTextField
              id="editProcName"
              label="Name"
              required
              value={editProcess.name}
              onChange={(e) => setEditProcess({ ...editProcess, name: e.target.value })}
            />
            <FormTextField
              id="editProcSeq"
              label="Sequence"
              type="number"
              value={editProcess.sequence}
              onChange={(e) => setEditProcess({ ...editProcess, sequence: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editProcess.active}
                onChange={(e) => setEditProcess({ ...editProcess, active: e.target.checked })}
              />
              Active
            </label>
          </ModalForm>
        ) : null}
      </Modal>

      <Modal
        open={subProcessModalOpen}
        title="Add Sub-process"
        description="Add a step under the selected process with an optional default role."
        onClose={() => setSubProcessModalOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton
              type="button"
              appVariant="outline"
              onClick={() => setSubProcessModalOpen(false)}
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={!subCode || !subName || createSubProcess.isPending}
              onClick={() => createSubProcess.mutate()}
            >
              {createSubProcess.isPending ? "Creating…" : "Create"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <ModalFormGrid>
            <FormTextField
              id="subCode"
              label="Code"
              required
              value={subCode}
              onChange={(e) => setSubCode(e.target.value)}
            />
            <FormTextField
              id="subName"
              label="Name"
              required
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
            />
          </ModalFormGrid>
          <ModalFormGrid>
            <FormTextField
              id="subSeq"
              label="Sequence"
              type="number"
              value={subSequence}
              onChange={(e) => setSubSequence(e.target.value)}
            />
            <FormSelect
              id="subRole"
              label="Default Role"
              value={defaultRoleId === "" ? null : String(defaultRoleId)}
              onValueChange={(v) => setDefaultRoleId(v ? Number(v) : "")}
              options={roles.map((role) => ({
                value: String(role.id),
                label: role.displayName,
              }))}
              placeholder="Select role (optional)"
            />
          </ModalFormGrid>
        </ModalForm>
      </Modal>

      <Modal
        open={!!editSubProcess}
        title="Edit Sub-process"
        onClose={() => setEditSubProcess(null)}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={() => setEditSubProcess(null)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={!editSubProcess?.name || updateSubProcess.isPending}
              onClick={() => {
                if (!editSubProcess) return;
                let wasActive = true;
                for (const process of processes) {
                  const found = process.subProcesses?.find((s) => s.id === editSubProcess.id);
                  if (found) {
                    wasActive = (found as { active?: boolean }).active !== false;
                    break;
                  }
                }
                if (wasActive && !editSubProcess.active) {
                  confirmDeactivateSubProcessFromEdit(editSubProcess);
                  return;
                }
                updateSubProcess.mutate(
                  {
                    id: editSubProcess.id,
                    name: editSubProcess.name,
                    sequence: Number(editSubProcess.sequence) || 1,
                    defaultRoleId:
                      editSubProcess.defaultRoleId === ""
                        ? null
                        : editSubProcess.defaultRoleId,
                    active: editSubProcess.active,
                  },
                  { onSuccess: () => setEditSubProcess(null) },
                );
              }}
            >
              {updateSubProcess.isPending ? "Saving…" : "Save"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        {editSubProcess ? (
          <ModalForm>
            <FormTextField
              id="editSubName"
              label="Name"
              required
              value={editSubProcess.name}
              onChange={(e) => setEditSubProcess({ ...editSubProcess, name: e.target.value })}
            />
            <ModalFormGrid>
              <FormTextField
                id="editSubSeq"
                label="Sequence"
                type="number"
                value={editSubProcess.sequence}
                onChange={(e) =>
                  setEditSubProcess({ ...editSubProcess, sequence: e.target.value })
                }
              />
              <FormSelect
                id="editSubRole"
                label="Default Role"
                value={
                  editSubProcess.defaultRoleId === ""
                    ? null
                    : String(editSubProcess.defaultRoleId)
                }
                onValueChange={(v) =>
                  setEditSubProcess({
                    ...editSubProcess,
                    defaultRoleId: v ? Number(v) : "",
                  })
                }
                options={roles.map((role) => ({
                  value: String(role.id),
                  label: role.displayName,
                }))}
                placeholder="Select role (optional)"
              />
            </ModalFormGrid>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editSubProcess.active}
                onChange={(e) =>
                  setEditSubProcess({ ...editSubProcess, active: e.target.checked })
                }
              />
              Active
            </label>
          </ModalForm>
        ) : null}
      </Modal>

      <Modal
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? "Confirm"}
        description={pendingConfirm?.description}
        size="sm"
        onClose={() => setPendingConfirm(null)}
        footer={
          <ModalFooterActions>
            <AppButton
              type="button"
              appVariant="outline"
              onClick={() => setPendingConfirm(null)}
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              appVariant="danger"
              disabled={
                setProcessActive.isPending ||
                setSubProcessActive.isPending ||
                updateProcess.isPending ||
                updateSubProcess.isPending
              }
              onClick={() => pendingConfirm?.onConfirm()}
            >
              {setProcessActive.isPending ||
              setSubProcessActive.isPending ||
              updateProcess.isPending ||
              updateSubProcess.isPending
                ? "Working…"
                : (pendingConfirm?.confirmLabel ?? "Confirm")}
            </AppButton>
          </ModalFooterActions>
        }
      >
        {pendingConfirm?.warning ? (
          <ModalAlert variant="warning">{pendingConfirm.warning}</ModalAlert>
        ) : null}
      </Modal>
      </>
    );
  }
}
