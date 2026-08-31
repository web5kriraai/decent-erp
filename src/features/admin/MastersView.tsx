"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { useProcessMasters } from "@/hooks/use-masters";
import { apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";

export function MastersView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const processesQuery = useProcessMasters(enabled);
  const queryClient = useQueryClient();
  const toast = useApiToast();

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sequence, setSequence] = useState("1");

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
      setOpen(false);
      setCode("");
      setName("");
    },
    onError: (error) => toast.errorFromApi(error, "Could not create process"),
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Process Masters"
        subtitle="Main processes, sub-processes, and workflow configuration"
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            Add Process
          </button>
        }
      />

      <QueryState
        isLoading={processesQuery.isLoading}
        isError={processesQuery.isError}
        error={processesQuery.error}
        onRetry={() => processesQuery.refetch()}
      >
        <DataTable
          columns={[
            { key: "sequence", header: "#", align: "center" },
            { key: "code", header: "Code" },
            { key: "name", header: "Process Name" },
            {
              key: "subProcesses",
              header: "Sub-processes",
              render: (row) => row.subProcesses?.length ?? 0,
            },
            {
              key: "status",
              header: "Status",
              render: () => <StatusBadge status="ACTIVE" label="Active" />,
            },
          ]}
          rows={processesQuery.data ?? []}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No process masters configured"
          emptyDescription="Seed workflow patterns and process masters to enable task generation."
        />
      </QueryState>

      <Modal
        open={open}
        title="Add Process"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
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
    </div>
  );
}
