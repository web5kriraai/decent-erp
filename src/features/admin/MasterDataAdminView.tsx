"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppButton } from "@/components/ui/AppButton";
import { MastersView } from "@/features/admin/MastersView";
import { MasterCatalogView } from "@/features/admin/MasterCatalogView";

const TABS = [
  { id: "processes", label: "Processes" },
  { id: "catalog", label: "Product Types & Seasons" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function MasterDataAdminView() {
  const [tab, setTab] = useState<TabId>("processes");

  return (
    <div className="page-shell">
      <PageHeader
        title="Master Data"
        subtitle="Processes, product types, seasons, and product–process mappings"
      />

      <div className="toolbar mb-4">
        {TABS.map((item) => (
          <AppButton
            key={item.id}
            type="button"
            size="sm"
            appVariant={tab === item.id ? "primary" : "secondary"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </AppButton>
        ))}
      </div>

      {tab === "processes" ? <MastersView embedded /> : <MasterCatalogView />}
    </div>
  );
}
