"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppButton } from "@/components/ui/AppButton";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { MastersView } from "@/features/admin/MastersView";
import { MasterCatalogView } from "@/features/admin/MasterCatalogView";
import { KpiWeightsAdminView } from "@/features/admin/KpiWeightsAdminView";
import { ConceptTargetsAdminView } from "@/features/admin/ConceptTargetsAdminView";

const TABS = [
  { id: "processes", label: "Processes" },
  { id: "catalog", label: "Master Catalog" },
  { id: "targets", label: "Concept Targets" },
  { id: "kpi", label: "KPI Weights" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value);
}

export function MasterDataAdminView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = useMemo(
    () => (isTabId(tabParam) ? tabParam : "processes"),
    [tabParam],
  );

  function setTab(next: TabId) {
    router.replace(`/admin/masters?tab=${next}`, { scroll: false });
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Master Data"
        subtitle="Processes, flat catalog lookups, concept targets, and KPI weights."
      />

      <PageToolbar panel className="mb-4" role="tablist" aria-label="Master data sections">
        {TABS.map((item) => (
          <AppButton
            key={item.id}
            type="button"
            size="sm"
            role="tab"
            aria-selected={tab === item.id}
            appVariant={tab === item.id ? "primary" : "secondary"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </AppButton>
        ))}
      </PageToolbar>

      {tab === "processes" ? (
        <MastersView embedded />
      ) : tab === "kpi" ? (
        <KpiWeightsAdminView />
      ) : tab === "targets" ? (
        <ConceptTargetsAdminView />
      ) : (
        <MasterCatalogView />
      )}
    </div>
  );
}
