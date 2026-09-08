"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { FormTextField } from "@/components/ui/form-text-field";
import { FormSelect } from "@/components/ui/form-select";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { useApiToast } from "@/components/ui/ToastProvider";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useProcessMasters } from "@/hooks/use-masters";

const SECTIONS = [
  { id: "holds", label: "Hold reasons" },
  { id: "skills", label: "Skills" },
  { id: "checklist", label: "Checklist" },
  { id: "approvals", label: "Approval levels" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function isSectionId(value: string | null): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

type HoldReasonRow = {
  id: number;
  code: string;
  name: string;
  excludeFromActiveTime?: boolean;
  active: boolean;
};

type SkillRow = {
  id: number;
  code: string;
  name: string;
  defaultRoleId?: number | null;
  active: boolean;
};

type ChecklistRow = {
  id: number;
  code: string;
  name: string;
  sequence: number;
  active: boolean;
  subProcessId?: number | null;
  subProcess?: { id: number; code: string; name: string } | null;
};

type ApprovalRow = {
  id: number;
  code: string;
  name: string;
  sequence: number;
  active: boolean;
};

export function StructuredMastersAdminView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const sectionParam = searchParams.get("section");
  const section: SectionId = useMemo(
    () => (isSectionId(sectionParam) ? sectionParam : "holds"),
    [sectionParam],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<{
    id: number;
    code: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sequence, setSequence] = useState("1");
  const [subProcessId, setSubProcessId] = useState<string>("");
  const [excludeFromActiveTime, setExcludeFromActiveTime] = useState(false);

  function setSection(next: SectionId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "structured");
    params.set("section", next);
    router.replace(`/admin/masters?${params.toString()}`, { scroll: false });
    setCreateOpen(false);
    setEditItem(null);
    resetForm();
  }

  function resetForm() {
    setCode("");
    setName("");
    setSequence("1");
    setSubProcessId("");
    setExcludeFromActiveTime(false);
  }

  function openEdit(row: {
    id: number;
    code: string;
    name: string;
    sequence?: number;
    subProcessId?: number | null;
    excludeFromActiveTime?: boolean;
  }) {
    setCreateOpen(false);
    setEditItem({ id: row.id, code: row.code });
    setCode(row.code);
    setName(row.name);
    setSequence(String(row.sequence ?? 1));
    setSubProcessId(row.subProcessId != null ? String(row.subProcessId) : "");
    setExcludeFromActiveTime(!!row.excludeFromActiveTime);
  }

  const holdsQuery = useQuery({
    queryKey: ["masters", "hold-reasons", "admin"],
    queryFn: () =>
      apiGet<HoldReasonRow[]>("/api/masters/hold-reasons?includeInactive=1"),
    enabled: section === "holds",
  });

  const skillsQuery = useQuery({
    queryKey: ["masters", "skills", "admin"],
    queryFn: () => apiGet<SkillRow[]>("/api/masters/skills?includeInactive=1"),
    enabled: section === "skills",
  });

  const checklistQuery = useQuery({
    queryKey: ["masters", "checklist", "admin"],
    queryFn: () =>
      apiGet<ChecklistRow[]>("/api/masters/checklist?includeInactive=1"),
    enabled: section === "checklist",
  });

  const approvalsQuery = useQuery({
    queryKey: ["masters", "approval-levels", "admin"],
    queryFn: () =>
      apiGet<ApprovalRow[]>("/api/masters/approval-levels?includeInactive=1"),
    enabled: section === "approvals",
  });

  const processesQuery = useProcessMasters(section === "checklist", true);
  const subProcessOptions = useMemo(() => {
    const rows =
      processesQuery.data?.flatMap((p) =>
        (p.subProcesses ?? []).map((sp) => ({
          value: String(sp.id),
          label: `${p.code} / ${sp.code} — ${sp.name}`,
        })),
      ) ?? [];
    return [{ value: "", label: "All stages (optional)" }, ...rows];
  }, [processesQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (section === "holds") {
        return apiPost("/api/masters/hold-reasons", {
          code,
          name,
          excludeFromActiveTime,
        });
      }
      if (section === "skills") {
        return apiPost("/api/masters/skills", { code, name });
      }
      if (section === "checklist") {
        return apiPost("/api/masters/checklist", {
          code,
          name,
          sequence: Number(sequence) || 1,
          subProcessId: subProcessId ? Number(subProcessId) : null,
        });
      }
      return apiPost("/api/masters/approval-levels", {
        code,
        name,
        sequence: Number(sequence) || 1,
      });
    },
    onSuccess: async () => {
      toast.success("Created", "Master row added.");
      setCreateOpen(false);
      resetForm();
      await invalidateSection(section);
    },
    onError: (error) => toast.errorFromApi(error, "Create failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (payload: { id: number; active: boolean }) => {
      if (section === "holds") {
        return apiPatch(`/api/masters/hold-reasons/${payload.id}`, {
          active: payload.active,
        });
      }
      if (section === "skills") {
        return apiPatch(`/api/masters/skills/${payload.id}`, {
          active: payload.active,
        });
      }
      if (section === "checklist") {
        return apiPatch(`/api/masters/checklist/${payload.id}`, {
          active: payload.active,
        });
      }
      return apiPatch(`/api/masters/approval-levels/${payload.id}`, {
        active: payload.active,
      });
    },
    onSuccess: async () => {
      toast.success("Updated", "Status saved.");
      await invalidateSection(section);
    },
    onError: (error) => toast.errorFromApi(error, "Update failed"),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) throw new Error("Nothing to edit");
      if (section === "holds") {
        return apiPatch(`/api/masters/hold-reasons/${editItem.id}`, {
          name,
          excludeFromActiveTime,
        });
      }
      if (section === "skills") {
        return apiPatch(`/api/masters/skills/${editItem.id}`, { name });
      }
      if (section === "checklist") {
        return apiPatch(`/api/masters/checklist/${editItem.id}`, {
          name,
          sequence: Number(sequence) || 1,
          subProcessId: subProcessId ? Number(subProcessId) : null,
        });
      }
      return apiPatch(`/api/masters/approval-levels/${editItem.id}`, {
        name,
        sequence: Number(sequence) || 1,
      });
    },
    onSuccess: async () => {
      toast.success("Updated", "Master row saved.");
      setEditItem(null);
      resetForm();
      await invalidateSection(section);
    },
    onError: (error) => toast.errorFromApi(error, "Update failed"),
  });

  async function invalidateSection(id: SectionId) {
    const map: Record<SectionId, readonly string[]> = {
      holds: queryKeys.masters.holdReasons,
      skills: queryKeys.masters.skills,
      checklist: queryKeys.masters.checklistItems,
      approvals: ["masters", "approval-levels"],
    };
    await queryClient.invalidateQueries({ queryKey: map[id] });
    await queryClient.invalidateQueries({ queryKey: ["masters", id === "holds" ? "hold-reasons" : id === "skills" ? "skills" : id === "checklist" ? "checklist" : "approval-levels"] });
  }

  const activeQuery =
    section === "holds"
      ? holdsQuery
      : section === "skills"
        ? skillsQuery
        : section === "checklist"
          ? checklistQuery
          : approvalsQuery;

  return (
    <div className="vstack vstack--loose">
      <PageToolbar panel className="mb-2" role="tablist" aria-label="Structured masters">
        {SECTIONS.map((item) => (
          <AppButton
            key={item.id}
            type="button"
            size="sm"
            role="tab"
            aria-selected={section === item.id}
            appVariant={section === item.id ? "primary" : "secondary"}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </AppButton>
        ))}
      </PageToolbar>

      <AppCard
        title={SECTIONS.find((s) => s.id === section)?.label ?? "Structured"}
        description="Create, edit, and activate or deactivate structured masters used by tasks and quality."
        flush
        headerAction={
          <AppButton
            type="button"
            appVariant="primary"
            size="sm"
            onClick={() => {
              setEditItem(null);
              setCreateOpen(true);
            }}
          >
            Add item
          </AppButton>
        }
      >
        <QueryState
          isLoading={activeQuery.isLoading}
          isError={activeQuery.isError}
          error={activeQuery.error}
          onRetry={() => activeQuery.refetch()}
          skeletonVariant="table"
        >
          {section === "holds" ? (
            <DataTable
              columns={[
                { key: "code", header: "Code", render: (r: HoldReasonRow) => r.code },
                { key: "name", header: "Name", render: (r: HoldReasonRow) => r.name },
                {
                  key: "exclude",
                  header: "Exclude time",
                  render: (r: HoldReasonRow) => (r.excludeFromActiveTime ? "Yes" : "No"),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r: HoldReasonRow) => (
                    <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} />
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (r: HoldReasonRow) => (
                    <TableIconActionGroup>
                      <TableIconAction action="edit" onClick={() => openEdit(r)} />
                      <TableIconAction
                        action={r.active ? "deactivate" : "activate"}
                        onClick={() =>
                          toggleMutation.mutate({ id: r.id, active: !r.active })
                        }
                      />
                    </TableIconActionGroup>
                  ),
                },
              ]}
              rows={holdsQuery.data ?? []}
              getRowKey={(r) => String(r.id)}
              emptyTitle="No hold reasons"
            />
          ) : null}

          {section === "skills" ? (
            <DataTable
              columns={[
                { key: "code", header: "Code", render: (r: SkillRow) => r.code },
                { key: "name", header: "Name", render: (r: SkillRow) => r.name },
                {
                  key: "status",
                  header: "Status",
                  render: (r: SkillRow) => (
                    <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} />
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (r: SkillRow) => (
                    <TableIconActionGroup>
                      <TableIconAction action="edit" onClick={() => openEdit(r)} />
                      <TableIconAction
                        action={r.active ? "deactivate" : "activate"}
                        onClick={() =>
                          toggleMutation.mutate({ id: r.id, active: !r.active })
                        }
                      />
                    </TableIconActionGroup>
                  ),
                },
              ]}
              rows={skillsQuery.data ?? []}
              getRowKey={(r) => String(r.id)}
              emptyTitle="No skills"
            />
          ) : null}

          {section === "checklist" ? (
            <DataTable
              columns={[
                { key: "seq", header: "#", render: (r: ChecklistRow) => r.sequence },
                { key: "code", header: "Code", render: (r: ChecklistRow) => r.code },
                { key: "name", header: "Name", render: (r: ChecklistRow) => r.name },
                {
                  key: "stage",
                  header: "Stage",
                  render: (r: ChecklistRow) =>
                    r.subProcess ? `${r.subProcess.code}` : "All",
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r: ChecklistRow) => (
                    <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} />
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (r: ChecklistRow) => (
                    <TableIconActionGroup>
                      <TableIconAction action="edit" onClick={() => openEdit(r)} />
                      <TableIconAction
                        action={r.active ? "deactivate" : "activate"}
                        onClick={() =>
                          toggleMutation.mutate({ id: r.id, active: !r.active })
                        }
                      />
                    </TableIconActionGroup>
                  ),
                },
              ]}
              rows={checklistQuery.data ?? []}
              getRowKey={(r) => String(r.id)}
              emptyTitle="No checklist items"
            />
          ) : null}

          {section === "approvals" ? (
            <DataTable
              columns={[
                { key: "seq", header: "#", render: (r: ApprovalRow) => r.sequence },
                { key: "code", header: "Code", render: (r: ApprovalRow) => r.code },
                { key: "name", header: "Name", render: (r: ApprovalRow) => r.name },
                {
                  key: "status",
                  header: "Status",
                  render: (r: ApprovalRow) => (
                    <StatusBadge status={r.active ? "ACTIVE" : "INACTIVE"} />
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (r: ApprovalRow) => (
                    <TableIconActionGroup>
                      <TableIconAction action="edit" onClick={() => openEdit(r)} />
                      <TableIconAction
                        action={r.active ? "deactivate" : "activate"}
                        onClick={() =>
                          toggleMutation.mutate({ id: r.id, active: !r.active })
                        }
                      />
                    </TableIconActionGroup>
                  ),
                },
              ]}
              rows={approvalsQuery.data ?? []}
              getRowKey={(r) => String(r.id)}
              emptyTitle="No approval levels"
            />
          ) : null}
        </QueryState>
      </AppCard>

      <Modal
        open={createOpen}
        title={`Add ${SECTIONS.find((s) => s.id === section)?.label ?? "item"}`}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        footer={
          <ModalFooterActions>
            <AppButton
              type="button"
              appVariant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={!code.trim() || !name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Saving…" : "Save"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <ModalFormGrid>
            <FormTextField
              id="structured-code"
              label="Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
            <FormTextField
              id="structured-name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {(section === "checklist" || section === "approvals") && (
              <FormTextField
                id="structured-sequence"
                label="Sequence"
                type="number"
                min={1}
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
              />
            )}
            {section === "checklist" ? (
              <FormSelect
                id="structured-subprocess"
                label="Sub-process"
                value={subProcessId || null}
                onValueChange={(v) => setSubProcessId(v ?? "")}
                options={subProcessOptions}
                placeholder="Optional stage…"
              />
            ) : null}
            {section === "holds" ? (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={excludeFromActiveTime}
                  onChange={(e) => setExcludeFromActiveTime(e.target.checked)}
                />
                Exclude from active time
              </label>
            ) : null}
          </ModalFormGrid>
        </ModalForm>
      </Modal>

      <Modal
        open={!!editItem}
        title={`Edit ${editItem?.code ?? ""}`}
        onClose={() => {
          setEditItem(null);
          resetForm();
        }}
        footer={
          <ModalFooterActions>
            <AppButton
              type="button"
              appVariant="outline"
              onClick={() => {
                setEditItem(null);
                resetForm();
              }}
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={!name.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "Saving…" : "Save changes"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <ModalFormGrid>
            <FormTextField
              id="structured-edit-code"
              label="Code"
              value={code}
              disabled
            />
            <FormTextField
              id="structured-edit-name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {(section === "checklist" || section === "approvals") && (
              <FormTextField
                id="structured-edit-sequence"
                label="Sequence"
                type="number"
                min={1}
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
              />
            )}
            {section === "checklist" ? (
              <FormSelect
                id="structured-edit-subprocess"
                label="Sub-process"
                value={subProcessId || null}
                onValueChange={(v) => setSubProcessId(v ?? "")}
                options={subProcessOptions}
                placeholder="Optional stage…"
              />
            ) : null}
            {section === "holds" ? (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={excludeFromActiveTime}
                  onChange={(e) => setExcludeFromActiveTime(e.target.checked)}
                />
                Exclude from active time
              </label>
            ) : null}
          </ModalFormGrid>
        </ModalForm>
      </Modal>
    </div>
  );
}
