"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ListPage } from "@/components/ui/ListPage";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { FormSelect } from "@/components/ui/form-select";
import { StatusBadge } from "@/components/StatusBadge";
import { useMasterCatalog } from "@/hooks/use-masters";
import { apiGet, apiPatch } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useClientList } from "@/hooks/use-client-list";
import { ROUTES } from "@/config/routes";
import { WorkdayStatusBanner } from "@/features/time/WorkdayStatusBanner";

type WorkbenchTask = {
  id: string;
  status: string;
  designId: string;
  design?: { ideaRef?: string; collectionName?: string };
  subProcess?: { code?: string; name?: string };
  sampleMachine?: { name?: string } | null;
} & Record<string, unknown>;

function taskSearchText(row: WorkbenchTask) {
  return `${row.design?.ideaRef ?? row.designId} ${row.design?.collectionName ?? ""} ${row.subProcess?.name ?? ""} ${row.sampleMachine?.name ?? ""} ${row.status}`;
}

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

  const getSearchText = useCallback(taskSearchText, []);
  const list = useClientList({
    items: listQuery.data ?? [],
    getSearchText,
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
    <ListPage
      title="Machine Sample"
      subtitle="Sample issue / receive queue with machine assignment"
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search sample jobs…",
        "aria-label": "Search sample jobs",
      }}
      filters={
        selectedTaskId ? (
          <div className="flex flex-wrap items-end gap-2">
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
              className="min-w-[10rem]"
            />
            <AppButton
              type="button"
              size="sm"
              disabled={!machineId || assign.isPending}
              onClick={() => assign.mutate()}
            >
              Assign Machine
            </AppButton>
            <AppButton
              type="button"
              size="sm"
              appVariant="ghost"
              onClick={() => {
                setSelectedTaskId(null);
                setMachineId("");
              }}
            >
              Cancel
            </AppButton>
          </div>
        ) : undefined
      }
      beforeTable={<WorkdayStatusBanner />}
      onRefresh={() => listQuery.refetch()}
      isRefreshing={listQuery.isFetching}
      query={{
        isLoading: listQuery.isLoading,
        isError: listQuery.isError,
        error: listQuery.error,
        onRetry: () => listQuery.refetch(),
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "sample-queue-page-size",
      }}
    >
      <DataTable
        flush
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) => (
              <Link href={ROUTES.work.taskDetail(row.id)} className="data-table-link">
                {row.design?.ideaRef ?? row.designId}
              </Link>
            ),
          },
          {
            key: "stage",
            header: "Stage",
            render: (row) => row.subProcess?.name ?? "-",
          },
          {
            key: "machine",
            header: "Machine",
            render: (row) => row.sampleMachine?.name ?? "-",
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row) => (
              <AppButton
                type="button"
                size="sm"
                appVariant={selectedTaskId === row.id ? "primary" : "secondary"}
                onClick={() => setSelectedTaskId(row.id)}
              >
                {selectedTaskId === row.id ? "Selected" : "Assign"}
              </AppButton>
            ),
          },
        ]}
        rows={list.pageItems}
        getRowKey={(row) => String(row.id)}
        emptyTitle="No sample jobs"
        emptyDescription="Jobs in sample stages will appear here."
      />
    </ListPage>
  );
}
