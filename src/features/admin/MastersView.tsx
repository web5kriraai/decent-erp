"use client";

import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
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
  const processesQuery = useProcessMasters(enabled);
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
      apiPatch(`/api/masters/processes/${payload.id}`, {
        name: payload.name,
        sequence: payload.sequence,
        active: payload.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      toast.success("Process updated");
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
      apiPatch(`/api/masters/sub-processes/${payload.id}`, {
        name: payload.name,
        sequence: payload.sequence,
        defaultRoleId: payload.defaultRoleId,
        active: payload.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.processes });
      toast.success("Sub-process updated");
      setEditSubProcess(null);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update sub-process"),
  });

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
            subtitle="Main processes, sub-processes, and workflow configuration"
            actions={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setProcessModalOpen(true)}
              >
                Add Process
              </button>
            }
          />
          {renderContent()}
        </div>
      ) : (
        <>
          <div className="flex justify-end" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setProcessModalOpen(true)}
            >
              Add Process
            </button>
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
        <div className="card">
          <div className="data-table-wrap">
            {processes.length === 0 ? (
              <p className="text-muted-inline">
                No process masters configured. Seed workflow patterns and process masters to enable
                task generation.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} aria-label="Expand" />
                      <th style={{ textAlign: "center" }}>#</th>
                      <th>Code</th>
                      <th>Process Name</th>
                      <th>Sub-processes</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
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
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? "Collapse sub-processes" : "Expand sub-processes"}
                                onClick={() => toggleExpanded(process.id)}
                              >
                                {isExpanded ? "▾" : "▸"}
                              </button>
                            </td>
                            <td style={{ textAlign: "center" }}>{process.sequence}</td>
                            <td>{process.code}</td>
                            <td>{process.name}</td>
                            <td>{subProcesses.length}</td>
                            <td>
                              <StatusBadge
                                status={isActive ? "ACTIVE" : "CLOSED"}
                                label={isActive ? "Active" : "Inactive"}
                              />
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div className="inline-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() =>
                                    setEditProcess({
                                      id: process.id,
                                      name: process.name,
                                      sequence: String(process.sequence),
                                      active: isActive,
                                    })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() =>
                                    openSubProcessModal(process.id, subProcesses.length + 1)
                                  }
                                >
                                  Add Sub-process
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} style={{ background: "var(--color-neutral-50)", padding: "0.75rem 1rem" }}>
                                {subProcesses.length === 0 ? (
                                  <p className="text-muted-inline">
                                    No sub-processes configured for this process.
                                  </p>
                                ) : (
                                  <table className="data-table" style={{ margin: 0 }}>
                                    <thead>
                                      <tr>
                                        <th style={{ textAlign: "center" }}>#</th>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Default Role</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: "right" }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subProcesses.map((sub) => {
                                        const subActive = (sub as { active?: boolean }).active !== false;
                                        return (
                                        <tr key={sub.id}>
                                          <td style={{ textAlign: "center" }}>{sub.sequence}</td>
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
                                          <td style={{ textAlign: "right" }}>
                                            <button
                                              type="button"
                                              className="btn btn-ghost btn-sm"
                                              onClick={() =>
                                                setEditSubProcess({
                                                  id: sub.id,
                                                  name: sub.name,
                                                  sequence: String(sub.sequence),
                                                  defaultRoleId: sub.defaultRoleId ?? "",
                                                  active: subActive,
                                                })
                                              }
                                            >
                                              Edit
                                            </button>
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
        </div>
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
            <Button type="button" variant="outline" onClick={() => setProcessModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!code || !name || createProcess.isPending}
              onClick={() => createProcess.mutate()}
            >
              {createProcess.isPending ? "Creating…" : "Create"}
            </Button>
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
            <Button type="button" variant="outline" onClick={() => setEditProcess(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editProcess?.name || updateProcess.isPending}
              onClick={() =>
                editProcess &&
                updateProcess.mutate({
                  id: editProcess.id,
                  name: editProcess.name,
                  sequence: Number(editProcess.sequence) || 1,
                  active: editProcess.active,
                })
              }
            >
              {updateProcess.isPending ? "Saving…" : "Save"}
            </Button>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubProcessModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!subCode || !subName || createSubProcess.isPending}
              onClick={() => createSubProcess.mutate()}
            >
              {createSubProcess.isPending ? "Creating…" : "Create"}
            </Button>
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
            <Button type="button" variant="outline" onClick={() => setEditSubProcess(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editSubProcess?.name || updateSubProcess.isPending}
              onClick={() =>
                editSubProcess &&
                updateSubProcess.mutate({
                  id: editSubProcess.id,
                  name: editSubProcess.name,
                  sequence: Number(editSubProcess.sequence) || 1,
                  defaultRoleId:
                    editSubProcess.defaultRoleId === ""
                      ? null
                      : editSubProcess.defaultRoleId,
                  active: editSubProcess.active,
                })
              }
            >
              {updateSubProcess.isPending ? "Saving…" : "Save"}
            </Button>
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
      </>
    );
  }
}
