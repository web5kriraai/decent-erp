"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useUpdateDesign } from "@/hooks/use-designs";
import type { DesignSummary, WorkType } from "@/lib/types/api";

type DesignEditModalProps = {
  design: DesignSummary;
  open: boolean;
  onClose: () => void;
};

export function DesignEditModal({ design, open, onClose }: DesignEditModalProps) {
  const updateDesign = useUpdateDesign();
  const [collectionName, setCollectionName] = useState(design.collectionName);
  const [conceptNote, setConceptNote] = useState(design.conceptNote ?? "");
  const [styleName, setStyleName] = useState(design.styleName ?? "");
  const [workType, setWorkType] = useState<WorkType | "">(design.workType ?? "");
  const [trendReference, setTrendReference] = useState(design.trendReference ?? "");
  const [celebrityReference, setCelebrityReference] = useState(design.celebrityReference ?? "");

  async function handleSave() {
    await updateDesign.mutateAsync({
      designId: design.id,
      version: design.version,
      collectionName: collectionName.trim(),
      conceptNote: conceptNote.trim() || undefined,
      styleName: styleName.trim() || undefined,
      workType: workType || undefined,
      trendReference: trendReference.trim() || undefined,
      celebrityReference: celebrityReference.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Edit Design Concept"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!collectionName.trim() || updateDesign.isPending}
            onClick={handleSave}
          >
            Save
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "1rem" }}>
        <div className="form-group">
          <label className="form-label">Collection Name *</label>
          <input className="form-input" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Style Name</label>
          <input className="form-input" value={styleName} onChange={(e) => setStyleName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Work Type</label>
          <select className="form-select" value={workType} onChange={(e) => setWorkType(e.target.value as WorkType | "")}>
            <option value="">Select…</option>
            <option value="NEW_DESIGN">New Design</option>
            <option value="REPEAT">Repeat</option>
            <option value="REVIVAL">Revival</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Concept Note</label>
          <textarea className="form-textarea" rows={3} value={conceptNote} onChange={(e) => setConceptNote(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Trend Reference</label>
          <input className="form-input" value={trendReference} onChange={(e) => setTrendReference(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Celebrity Reference</label>
          <input className="form-input" value={celebrityReference} onChange={(e) => setCelebrityReference(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
