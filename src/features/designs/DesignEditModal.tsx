"use client";

import { useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton } from "@/components/ui/AppButton";
import { useUpdateDesign } from "@/hooks/use-designs";
import type { DesignSummary, WorkType } from "@/lib/types/api";

type DesignEditModalProps = {
  design: DesignSummary;
  open: boolean;
  onClose: () => void;
};

const WORK_TYPE_OPTIONS = [
  { value: "NEW_DESIGN", label: "New Design" },
  { value: "REPEAT", label: "Repeat" },
  { value: "REVIVAL", label: "Revival" },
  { value: "CUSTOM", label: "Custom" },
];

export function DesignEditModal({ design, open, onClose }: DesignEditModalProps) {
  const updateDesign = useUpdateDesign();
  const [collectionName, setCollectionName] = useState(design.collectionName);
  const [conceptNote, setConceptNote] = useState(design.conceptNote ?? "");
  const [styleName, setStyleName] = useState(design.styleName ?? "");
  const [workType, setWorkType] = useState<WorkType | "">(design.workType ?? "");
  const [trendReference, setTrendReference] = useState(design.trendReference ?? "");
  const [celebrityReference, setCelebrityReference] = useState(design.celebrityReference ?? "");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const collectionError = !collectionName.trim() ? "Collection name is required" : undefined;
  const canSave = !collectionError && !updateDesign.isPending;

  async function handleSave() {
    setAttemptedSubmit(true);
    if (collectionError || updateDesign.isPending) return;
    await updateDesign.mutateAsync({
      designId: design.id,
      version: design.version ?? 1,
      collectionName: collectionName.trim(),
      conceptNote: conceptNote.trim() || undefined,
      styleName: styleName.trim() || undefined,
      workType: workType || undefined,
      trendReference: trendReference.trim() || undefined,
      celebrityReference: celebrityReference.trim() || undefined,
    });
    setAttemptedSubmit(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Edit Design"
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="primary"
            disabled={updateDesign.isPending}
            onClick={() => void handleSave()}
          >
            {updateDesign.isPending ? "Saving…" : "Save"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ModalFormGrid>
          <FormTextField
            id="editCollection"
            label="Collection Name"
            required
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            error={attemptedSubmit ? collectionError : undefined}
          />
          <FormTextField
            id="editStyleName"
            label="Style Name"
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
          />
        </ModalFormGrid>
        <FormSelect
          id="editWorkType"
          label="Work Type"
          value={workType || null}
          onValueChange={(v) => setWorkType(v as WorkType)}
          options={WORK_TYPE_OPTIONS}
          placeholder="Select…"
        />
        <FormTextArea
          id="editConceptNote"
          label="Concept Note"
          rows={3}
          value={conceptNote}
          onChange={(e) => setConceptNote(e.target.value)}
          onEnterSubmit={canSave ? () => void handleSave() : undefined}
        />
        <ModalFormGrid>
          <FormTextField
            id="editTrend"
            label="Trend Reference"
            value={trendReference}
            onChange={(e) => setTrendReference(e.target.value)}
          />
          <FormTextField
            id="editCelebrity"
            label="Celebrity Reference"
            value={celebrityReference}
            onChange={(e) => setCelebrityReference(e.target.value)}
          />
        </ModalFormGrid>
      </ModalForm>
    </Modal>
  );
}
