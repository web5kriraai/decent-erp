"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { apiGet } from "@/lib/api-client";
import { ROUTES } from "@/config/routes";
import {
  formatMachineOutputSummary,
  pickPreferredSampleOutput,
} from "@/lib/services/task-machine-output-utils";

type WorkbenchTask = {
  id: string;
  status: string;
  designId: string;
  design?: { ideaRef?: string; collectionName?: string };
  subProcess?: { code?: string; name?: string };
  assignedEmployee?: { name?: string } | null;
  artifacts?: Array<{
    artifactType: string;
    stitchCount?: number | null;
    machineFormat?: string | null;
    sampleQty?: number | null;
    wastageQty?: number | null;
    storageKey?: string | null;
    fileName?: string | null;
  }>;
  sampleMachine?: { name?: string; code?: string } | null;
};

export function OpsWorkbenchView({
  title,
  subtitle,
  stageCodes,
}: {
  title: string;
  subtitle: string;
  stageCodes: string[];
}) {
  const listQuery = useQuery({
    queryKey: ["workbench", stageCodes.join(",")],
    queryFn: () =>
      apiGet<WorkbenchTask[]>(
        `/api/tasks/workbench?stages=${encodeURIComponent(stageCodes.join(","))}`,
      ),
  });

  return (
    <div className="page-shell">
      <PageHeader title={title} />
      <p className="text-sm text-muted-foreground" style={{ marginTop: -8 }}>
        {subtitle}
      </p>
      <AppCard title="Queue">
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
                render: (row) => row.subProcess?.name ?? row.subProcess?.code ?? "—",
              },
              {
                key: "owner",
                header: "Owner",
                render: (row) => row.assignedEmployee?.name ?? "Unassigned",
              },
              {
                key: "machine",
                header: "Machine",
                render: (row) => row.sampleMachine?.name ?? "—",
              },
              {
                key: "meta",
                header: "Output",
                render: (row) => {
                  const preferred = pickPreferredSampleOutput(row.artifacts ?? []);
                  return formatMachineOutputSummary(preferred) ?? "—";
                },
              },
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusBadge status={row.status} />,
              },
            ]}
            rows={listQuery.data ?? []}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No jobs in this workbench"
          />
        </QueryState>
      </AppCard>
    </div>
  );
}
