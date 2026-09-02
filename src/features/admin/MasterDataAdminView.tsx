"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
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

      <div className="toolbar" style={{ marginBottom: "1rem" }}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`btn btn-sm ${tab === item.id ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "processes" ? <MastersView embedded /> : <MasterCatalogView />}
    </div>
  );
}
