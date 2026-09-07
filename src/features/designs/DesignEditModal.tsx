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
import {
  useDesignGrades,
  useFabrics,
  useMachines,
  useMasterCatalog,
  useStitchingTypes,
} from "@/hooks/use-masters";
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
  const fabrics = useFabrics(open);
  const machines = useMachines(open);
  const stitchingTypes = useStitchingTypes(open);
  const designGrades = useDesignGrades(open);
  const styles = useMasterCatalog("STYLE", open);
  const celebrities = useMasterCatalog("CELEBRITY", open);
  const themes = useMasterCatalog("THEME", open);
  const workTypesCatalog = useMasterCatalog("WORK_TYPE", open);

  const [collectionName, setCollectionName] = useState(design.collectionName);
  const [conceptNote, setConceptNote] = useState(design.conceptNote ?? "");
  const [styleName, setStyleName] = useState(design.styleName ?? "");
  const [workType, setWorkType] = useState<WorkType | "">(design.workType ?? "");
  const [trendReference, setTrendReference] = useState(design.trendReference ?? "");
  const [celebrityReference, setCelebrityReference] = useState(design.celebrityReference ?? "");
  const [fabricId, setFabricId] = useState<number | "">(design.fabricId ?? "");
  const [machineId, setMachineId] = useState<number | "">(design.machineId ?? "");
  const [stitchingTypeId, setStitchingTypeId] = useState<number | "">(
    design.stitchingTypeId ?? "",
  );
  const [designGradeId, setDesignGradeId] = useState<number | "">(design.designGradeId ?? "");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const formKey = `${open}:${design.id}:${design.version ?? 0}`;
  const [loadedKey, setLoadedKey] = useState(formKey);

  if (open && formKey !== loadedKey) {
    setLoadedKey(formKey);
    setCollectionName(design.collectionName);
    setConceptNote(design.conceptNote ?? "");
    setStyleName(design.styleName ?? "");
    setWorkType(design.workType ?? "");
    setTrendReference(design.trendReference ?? "");
    setCelebrityReference(design.celebrityReference ?? "");
    setFabricId(design.fabricId ?? "");
    setMachineId(design.machineId ?? "");
    setStitchingTypeId(design.stitchingTypeId ?? "");
    setDesignGradeId(design.designGradeId ?? "");
    setAttemptedSubmit(false);
  }

  const collectionError = !collectionName.trim() ? "Collection name is required" : undefined;

  async function handleSave() {
    setAttemptedSubmit(true);
    if (collectionError || updateDesign.isPending) return;
    const grade = (designGrades.data ?? []).find((g) => g.id === designGradeId);
    await updateDesign.mutateAsync({
      designId: design.id,
      version: design.version ?? 1,
      collectionName: collectionName.trim(),
      conceptNote: conceptNote.trim() || undefined,
      styleName: styleName.trim() || undefined,
      workType: workType || undefined,
      trendReference: trendReference.trim() || undefined,
      celebrityReference: celebrityReference.trim() || undefined,
      fabricId: fabricId === "" ? null : Number(fabricId),
      machineId: machineId === "" ? null : Number(machineId),
      stitchingTypeId: stitchingTypeId === "" ? null : Number(stitchingTypeId),
      designGradeId: designGradeId === "" ? null : Number(designGradeId),
      targetGrade: grade?.name ?? design.targetGrade ?? null,
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
          <FormSelect
            id="editStyleName"
            label="Style"
            value={styleName || null}
            onValueChange={(v) => setStyleName(v ?? "")}
            options={(styles.data ?? []).map((s) => ({ value: s.name, label: s.name }))}
            placeholder="Select style…"
          />
        </ModalFormGrid>
        <ModalFormGrid>
          <FormSelect
            id="editWorkType"
            label="Work Type"
            value={workType || null}
            onValueChange={(v) => setWorkType(v as WorkType)}
            options={
              (workTypesCatalog.data ?? []).length > 0
                ? (workTypesCatalog.data ?? []).map((w) => ({
                    value: w.code as WorkType,
                    label: w.name,
                  }))
                : WORK_TYPE_OPTIONS
            }
            placeholder="Select…"
          />
          <FormSelect
            id="editTheme"
            label="Theme"
            value={trendReference || null}
            onValueChange={(v) => setTrendReference(v ?? "")}
            options={(themes.data ?? []).map((t) => ({ value: t.name, label: t.name }))}
            placeholder="Select theme…"
          />
        </ModalFormGrid>
        <ModalFormGrid>
          <FormSelect
            id="editCelebrity"
            label="Celebrity"
            value={celebrityReference || null}
            onValueChange={(v) => setCelebrityReference(v ?? "")}
            options={(celebrities.data ?? []).map((c) => ({ value: c.name, label: c.name }))}
            placeholder="Select…"
          />
          <FormSelect
            id="editGrade"
            label="Design Grade"
            value={designGradeId === "" ? null : String(designGradeId)}
            onValueChange={(v) => setDesignGradeId(v ? Number(v) : "")}
            options={(designGrades.data ?? []).map((g) => ({
              value: String(g.id),
              label: g.name,
            }))}
            placeholder="Select…"
          />
        </ModalFormGrid>
        <ModalFormGrid>
          <FormSelect
            id="editFabric"
            label="Fabric"
            value={fabricId === "" ? null : String(fabricId)}
            onValueChange={(v) => setFabricId(v ? Number(v) : "")}
            options={(fabrics.data ?? []).map((f) => ({
              value: String(f.id),
              label: f.name,
            }))}
            placeholder="Select…"
          />
          <FormSelect
            id="editMachine"
            label="Machine"
            value={machineId === "" ? null : String(machineId)}
            onValueChange={(v) => setMachineId(v ? Number(v) : "")}
            options={(machines.data ?? []).map((m) => ({
              value: String(m.id),
              label: m.name,
            }))}
            placeholder="Select…"
          />
        </ModalFormGrid>
        <FormSelect
          id="editStitching"
          label="Stitching Type"
          value={stitchingTypeId === "" ? null : String(stitchingTypeId)}
          onValueChange={(v) => setStitchingTypeId(v ? Number(v) : "")}
          options={(stitchingTypes.data ?? []).map((s) => ({
            value: String(s.id),
            label: s.name,
          }))}
          placeholder="Select…"
        />
        <FormTextArea
          id="editConcept"
          label="Concept Note"
          rows={3}
          value={conceptNote}
          onChange={(e) => setConceptNote(e.target.value)}
        />
      </ModalForm>
    </Modal>
  );
}
