"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppButton } from "@/components/ui/AppButton";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { PermissionDenied } from "@/components/PermissionDenied";
import { MastersView } from "@/features/admin/MastersView";
import { MasterCatalogView } from "@/features/admin/MasterCatalogView";
import { StructuredMastersAdminView } from "@/features/admin/StructuredMastersAdminView";
import { KpiWeightsAdminView } from "@/features/admin/KpiWeightsAdminView";
import { ConceptTargetsAdminView } from "@/features/admin/ConceptTargetsAdminView";
import { PERMISSIONS } from "@/lib/permissions";
import type { MasterDataPrimaryAction } from "@/features/admin/master-data-primary-action";

const TABS = [
  { id: "processes", label: "Processes" },
  { id: "catalog", label: "Master Catalog" },
  { id: "structured", label: "Structured" },
  { id: "targets", label: "Concept Targets" },
  { id: "kpi", label: "KPI Weights" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value);
}

export function MasterDataAdminView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canAdmin = permissions.includes(PERMISSIONS.MASTER_ADMIN);

  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = useMemo(
    () => (isTabId(tabParam) ? tabParam : "processes"),
    [tabParam],
  );

  const [primaryAction, setPrimaryAction] = useState<MasterDataPrimaryAction>(null);
  const registerPrimaryAction = useCallback((action: MasterDataPrimaryAction) => {
    setPrimaryAction(action);
  }, []);

  function setTab(next: TabId) {
    setPrimaryAction(null);
    router.replace(`/admin/masters?tab=${next}`, { scroll: false });
  }

  if (!canAdmin) {
    return <PermissionDenied />;
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Master Data"
        actions={
          primaryAction ? (
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </AppButton>
          ) : null
        }
      />

      <PageToolbar panel className="!mb-0" role="tablist" aria-label="Master data sections">
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
        <MastersView embedded registerPrimaryAction={registerPrimaryAction} />
      ) : tab === "structured" ? (
        <StructuredMastersAdminView registerPrimaryAction={registerPrimaryAction} />
      ) : tab === "kpi" ? (
        <KpiWeightsAdminView />
      ) : tab === "targets" ? (
        <ConceptTargetsAdminView />
      ) : (
        <MasterCatalogView registerPrimaryAction={registerPrimaryAction} />
      )}
    </div>
  );
}
