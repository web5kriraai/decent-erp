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
import { Button } from "@/components/ui/button";
import { useDesignsList } from "@/hooks/use-designs";
import { useDesign } from "@/hooks/use-designs";
import { useEmployeeOptions, useRaiseCorrection } from "@/hooks/use-corrections";
import type { RaiseCorrectionPayload } from "@/hooks/use-corrections";

type RaiseCorrectionModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDesignId?: string;
  defaultTaskId?: string;
};

const CORRECTION_TYPE_OPTIONS: {
  value: RaiseCorrectionPayload["correctionType"];
  label: string;
}[] = [
  { value: "MISTAKE", label: "Mistake" },
  { value: "IMPROVEMENT", label: "Improvement" },
  { value: "CUSTOMER_CHANGE", label: "Customer Change" },
  { value: "MACHINE", label: "Machine Issue" },
  { value: "MATERIAL", label: "Material Issue" },
  { value: "OTHER", label: "Other" },
];

function buildInitialState(defaultDesignId?: string, defaultTaskId?: string) {
  return {
    designId: defaultDesignId ?? "",
    taskId: defaultTaskId ?? "",
    correctionType: "IMPROVEMENT" as RaiseCorrectionPayload["correctionType"],
    responsibleEmployeeId: "" as number | "",
    rootCause: "",
  };
}

export function RaiseCorrectionModal({
  open,
  onClose,
  defaultDesignId,
  defaultTaskId,
}: RaiseCorrectionModalProps) {
  const isPrefilled = !!(defaultDesignId && defaultTaskId);
  const designsQuery = useDesignsList(open && !isPrefilled);
  const employeesQuery = useEmployeeOptions(open);
  const raiseCorrection = useRaiseCorrection();

  const openKey = open ? `${defaultDesignId ?? ""}:${defaultTaskId ?? ""}` : "closed";
  const [loadedKey, setLoadedKey] = useState("closed");
  const [designId, setDesignId] = useState(defaultDesignId ?? "");
  const [taskId, setTaskId] = useState(defaultTaskId ?? "");
  const [correctionType, setCorrectionType] =
    useState<RaiseCorrectionPayload["correctionType"]>("IMPROVEMENT");
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<number | "">("");
  const [rootCause, setRootCause] = useState("");

  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    const initial = buildInitialState(defaultDesignId, defaultTaskId);
    setDesignId(initial.designId);
    setTaskId(initial.taskId);
    setCorrectionType(initial.correctionType);
    setResponsibleEmployeeId(initial.responsibleEmployeeId);
    setRootCause(initial.rootCause);
  }

  const designQuery = useDesign(designId, open && !!designId && !isPrefilled);
  const tasks = designQuery.data?.tasks ?? [];
  const isMistake = correctionType === "MISTAKE";

  function handleClose() {
    setLoadedKey("closed");
    onClose();
  }

  function handleCorrectionTypeChange(value: RaiseCorrectionPayload["correctionType"]) {
    setCorrectionType(value);
    if (value !== "MISTAKE") {
      setResponsibleEmployeeId("");
    }
  }

  async function handleSubmit() {
    if (!designId || !taskId || !rootCause.trim()) return;
    if (isMistake && !responsibleEmployeeId) return;
    await raiseCorrection.mutateAsync({
      designId,
      taskId,
      correctionType,
      responsibleEmployeeId: responsibleEmployeeId ? Number(responsibleEmployeeId) : null,
      rootCause: rootCause.trim(),
    });
    handleClose();
  }

  const canSubmit =
    !!designId &&
    !!taskId &&
    !!rootCause.trim() &&
    (!isMistake || !!responsibleEmployeeId) &&
    !raiseCorrection.isPending;

  return (
    <Modal
      open={open}
      title="Raise Correction"
      description="Send work back with a clear reason so the responsible person can fix it."
      onClose={handleClose}
      size="lg"
      footer={
        <ModalFooterActions>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {raiseCorrection.isPending ? "Raising…" : "Raise Correction"}
          </Button>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        {!isPrefilled ? (
          <>
            <FormSelect
              id="corrDesign"
              label="Design"
              required
              value={designId || null}
              onValueChange={setDesignId}
              options={(designsQuery.data?.items ?? []).map((d) => ({
                value: d.id,
                label: `${d.ideaRef} - ${d.collectionName}`,
              }))}
              placeholder="Select design…"
            />

            <FormSelect
              id="corrTask"
              label="Task"
              required
              value={taskId || null}
              onValueChange={setTaskId}
              options={tasks.map((t) => ({
                value: t.id,
                label: `${t.process.name} → ${t.subProcess.name} (${t.status})`,
              }))}
              placeholder="Select task…"
              disabled={!designId || designQuery.isLoading}
            />
          </>
        ) : null}

        <ModalFormGrid>
          <FormSelect
            id="corrType"
            label="Type"
            required
            value={correctionType}
            onValueChange={(v) =>
              handleCorrectionTypeChange(v as RaiseCorrectionPayload["correctionType"])
            }
            options={CORRECTION_TYPE_OPTIONS}
          />
          <FormSelect
            id="corrResponsible"
            label="Responsible Employee"
            required={isMistake}
            value={responsibleEmployeeId === "" ? null : String(responsibleEmployeeId)}
            onValueChange={(v) => setResponsibleEmployeeId(v ? Number(v) : "")}
            options={(employeesQuery.data ?? []).map((e) => ({
              value: String(e.id),
              label: `${e.name} (${e.employeeCode})`,
            }))}
            placeholder="Select employee…"
            hint={isMistake ? undefined : "Optional for non-mistake corrections"}
          />
        </ModalFormGrid>

        <FormTextArea
          id="corrRootCause"
          label="Reason / feedback"
          required
          rows={3}
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          placeholder="Describe what needs to be fixed…"
        />
      </ModalForm>
    </Modal>
  );
}
