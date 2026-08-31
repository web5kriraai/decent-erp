"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { useCreateDesign } from "@/hooks/use-designs";
import { useProductTypes, useSeasons, useWorkflowPatterns } from "@/hooks/use-masters";
import { getFieldErrors, ApiClientError } from "@/lib/api-client";
import type { Priority } from "@/lib/types/api";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ROUTES } from "@/config/routes";

export function DesignCreateForm() {
  const router = useRouter();
  const createDesign = useCreateDesign();

  const productTypes = useProductTypes();
  const seasons = useSeasons();
  const patterns = useWorkflowPatterns();

  const [collectionName, setCollectionName] = useState("");
  const [conceptNote, setConceptNote] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [workflowPatternId, setWorkflowPatternId] = useState<number | "">("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const mastersLoading =
    productTypes.isLoading || seasons.isLoading || patterns.isLoading;

  const validationErrors: Record<string, string> = {};
  if (!collectionName.trim()) validationErrors.collectionName = "Collection name is required";
  if (!productTypeId) validationErrors.productTypeId = "Product type is required";
  if (!seasonId) validationErrors.seasonId = "Season is required";
  if (!workflowPatternId) validationErrors.workflowPatternId = "Workflow pattern is required";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    if (Object.keys(validationErrors).length > 0) return;

    try {
      const design = await createDesign.mutateAsync({
        productTypeId: Number(productTypeId),
        seasonId: Number(seasonId),
        collectionName: collectionName.trim(),
        conceptNote: conceptNote.trim() || undefined,
        priority,
        assignmentMode: "AUTOMATIC",
        workflowPatternId: Number(workflowPatternId),
      });
      router.push(ROUTES.designs.detail(design.id));
    } catch (error) {
      if (error instanceof ApiClientError && error.details) {
        setFieldErrors(getFieldErrors(error.details));
      }
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Create Design Concept"
        subtitle="Design + tasks saved in one transaction — identity from your session"
        actions={
          <Link href={ROUTES.designs.list} className="btn btn-secondary">
            Cancel
          </Link>
        }
      />

      <QueryState
        isLoading={mastersLoading}
        isError={productTypes.isError || seasons.isError || patterns.isError}
        error={productTypes.error ?? seasons.error ?? patterns.error}
        onRetry={() => {
          productTypes.refetch();
          seasons.refetch();
          patterns.refetch();
        }}
        skeletonVariant="table"
      >
        <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 720 }}>
          {createDesign.isError && createDesign.error instanceof ApiClientError && (
            <div style={{ marginBottom: "1rem" }}>
              <ErrorBanner
                message={createDesign.error.message}
                correlationId={createDesign.error.correlationId}
              />
            </div>
          )}

          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="collection">
                Collection Name *
              </label>
              <input
                id="collection"
                className="form-input"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g. Royal Festive 2026"
              />
              {(validationErrors.collectionName || fieldErrors.collectionName) && (
                <span className="form-error">
                  {validationErrors.collectionName ?? fieldErrors.collectionName?.[0]}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="concept">
                Concept Note
              </label>
              <textarea
                id="concept"
                className="form-textarea"
                rows={3}
                value={conceptNote}
                onChange={(e) => setConceptNote(e.target.value)}
                placeholder="Premium zari + thread concept…"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="productType">
                  Product Type *
                </label>
                <select
                  id="productType"
                  className="form-select"
                  value={productTypeId}
                  onChange={(e) => setProductTypeId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select type…</option>
                  {productTypes.data?.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
                {validationErrors.productTypeId && (
                  <span className="form-error">{validationErrors.productTypeId}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="season">
                  Season *
                </label>
                <select
                  id="season"
                  className="form-select"
                  value={seasonId}
                  onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select season…</option>
                  {seasons.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {validationErrors.seasonId && (
                  <span className="form-error">{validationErrors.seasonId}</span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="priority">
                  Priority
                </label>
                <select
                  id="priority"
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pattern">
                  Workflow Pattern *
                </label>
                <select
                  id="pattern"
                  className="form-select"
                  value={workflowPatternId}
                  onChange={(e) =>
                    setWorkflowPatternId(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Select pattern…</option>
                  {patterns.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (v{p.versionNo})
                    </option>
                  ))}
                </select>
                {validationErrors.workflowPatternId && (
                  <span className="form-error">{validationErrors.workflowPatternId}</span>
                )}
              </div>
            </div>

            <p className="form-hint">
              First task is auto-assigned to you as Design Head. Timer and KPI events are
              server-authoritative.
            </p>

            <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.5rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createDesign.isPending}
              >
                {createDesign.isPending ? "Creating…" : "Create & Generate Tasks"}
              </button>
              <Link href="/designs" className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </QueryState>
    </div>
  );
}
