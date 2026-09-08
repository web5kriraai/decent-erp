"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OpsWorkbenchView } from "@/features/work/OpsWorkbenchView";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { FormSelect } from "@/components/ui/form-select";
import { useMasterCatalog } from "@/hooks/use-masters";
import { apiGet, apiPatch } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import Link from "next/link";
import { ROUTES } from "@/config/routes";

type WorkbenchTask = {
  id: string;
  status: string;
  designId: string;
  design?: { ideaRef?: string };
  subProcess?: { code?: string; name?: string };
  sampleMachine?: { name?: string } | null;
};

export default function SampleWorkbenchPage() {
  const machines = useMasterCatalog("MACHINE");
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState("");

  const listQuery = useQuery({
    queryKey: ["workbench", "MACHINE_SAMPLE,SAMPLE_RECEIVE,SAMPLE_CHECK,RESAMPLE"],
    queryFn: () =>
      apiGet<WorkbenchTask[]>(
        `/api/tasks/workbench?stages=${encodeURIComponent(
          "MACHINE_SAMPLE,SAMPLE_RECEIVE,SAMPLE_CHECK,RESAMPLE",
        )}`,
      ),
  });

  const assign = useMutation({
    mutationFn: () =>
      apiPatch(`/api/tasks/${selectedTaskId}/sample-machine`, {
        sampleMachineId: Number(machineId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workbench"] });
      toast.success("Sample machine assigned");
      setSelectedTaskId(null);
      setMachineId("");
    },
    onError: (e) => toast.errorFromApi(e, "Could not assign machine"),
  });

  return (
    <div className="vstack vstack--loose">
      <OpsWorkbenchView
        title="Machine Sample"
        subtitle="Sample issue / receive queue with machine assignment"
        stageCodes={["MACHINE_SAMPLE", "SAMPLE_RECEIVE", "SAMPLE_CHECK", "RESAMPLE"]}
      />
      <div className="px-[var(--content-padding)] pb-2">
        <AppButtonLink href={ROUTES.work.sampleKanban} appVariant="secondary" size="sm">
          Open Sample Kanban (Pass / Hold / Reject)
        </AppButtonLink>
      </div>
      <div className="px-[var(--content-padding)] pb-[var(--content-padding)]">
        <AppCard title="Assign machine from queue">
          <QueryState
            isLoading={listQuery.isLoading}
            isError={listQuery.isError}
            error={listQuery.error}
            onRetry={() => listQuery.refetch()}
            skeletonVariant="table"
          >
            <DataTable
              columns={[
                {
                  key: "design",
                  header: "Design",
                  render: (row) => (
                    <Link href={ROUTES.work.taskDetail(row.id)}>
                      {row.design?.ideaRef ?? row.designId}
                    </Link>
                  ),
                },
                {
                  key: "stage",
                  header: "Stage",
                  render: (row) => row.subProcess?.name ?? "—",
                },
                {
                  key: "machine",
                  header: "Machine",
                  render: (row) => row.sampleMachine?.name ?? "—",
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) => (
                    <AppButton
                      type="button"
                      size="sm"
                      appVariant={selectedTaskId === row.id ? "primary" : "secondary"}
                      onClick={() => setSelectedTaskId(row.id)}
                    >
                      Select
                    </AppButton>
                  ),
                },
              ]}
              rows={listQuery.data ?? []}
              getRowKey={(row) => String(row.id)}
              emptyTitle="No sample jobs"
            />
          </QueryState>
          {selectedTaskId ? (
            <div style={{ display: "grid", gap: 12, maxWidth: 420, marginTop: 16 }}>
              <p className="m-0 text-sm">Task {selectedTaskId}</p>
              <FormSelect
                id="sample-machine"
                label="Machine"
                value={machineId || null}
                onValueChange={setMachineId}
                options={(machines.data ?? []).map((m) => ({
                  value: String(m.id),
                  label: m.name,
                }))}
                placeholder="Select…"
              />
              <AppButton
                type="button"
                disabled={!machineId || assign.isPending}
                onClick={() => assign.mutate()}
              >
                Assign Machine
              </AppButton>
            </div>
          ) : null}
        </AppCard>
      </div>
    </div>
  );
}
