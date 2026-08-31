"use client";

import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { useProcessMasters } from "@/hooks/use-masters";
import { useAdminRoles } from "@/hooks/use-admin-roles";
import { apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";

export function MastersView() {
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
              <p style={{ margin: 0, color: "var(--color-neutral-500)" }}>
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
                              <StatusBadge status="ACTIVE" label="Active" />
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  openSubProcessModal(process.id, subProcesses.length + 1)
                                }
                              >
                                Add Sub-process
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} style={{ background: "var(--color-neutral-50)", padding: "0.75rem 1rem" }}>
                                {subProcesses.length === 0 ? (
                                  <p style={{ margin: 0, color: "var(--color-neutral-500)" }}>
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
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subProcesses.map((sub) => (
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
                                        </tr>
                                      ))}
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

      <Modal
        open={processModalOpen}
        title="Add Process"
        onClose={() => setProcessModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setProcessModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!code || !name || createProcess.isPending}
              onClick={() => createProcess.mutate()}
            >
              Create
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label" htmlFor="procCode">
            Code *
          </label>
          <input
            id="procCode"
            className="form-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="procName">
            Name *
          </label>
          <input
            id="procName"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="procSeq">
            Sequence
          </label>
          <input
            id="procSeq"
            type="number"
            className="form-input"
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={subProcessModalOpen}
        title="Add Sub-process"
        onClose={() => setSubProcessModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSubProcessModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!subCode || !subName || createSubProcess.isPending}
              onClick={() => createSubProcess.mutate()}
            >
              Create
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label" htmlFor="subCode">
            Code *
          </label>
          <input
            id="subCode"
            className="form-input"
            value={subCode}
            onChange={(e) => setSubCode(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="subName">
            Name *
          </label>
          <input
            id="subName"
            className="form-input"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="subSeq">
            Sequence
          </label>
          <input
            id="subSeq"
            type="number"
            className="form-input"
            value={subSequence}
            onChange={(e) => setSubSequence(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="subRole">
            Default Role
          </label>
          <select
            id="subRole"
            className="form-input"
            value={defaultRoleId}
            onChange={(e) => setDefaultRoleId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select role (optional)</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.displayName}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
