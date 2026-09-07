"use client";

import { useMemo, useState } from "react";
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
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import { useDesignsList } from "@/hooks/use-designs";
import { useDesign } from "@/hooks/use-designs";
import { useEmployeeOptions, useRaiseCorrection } from "@/hooks/use-corrections";
import type { RaiseCorrectionPayload } from "@/hooks/use-corrections";
import type { HandoffContext } from "@/lib/handoff-context";
import {
  correctionRouteCodesFromStages,
  suggestedCorrectionRouteCode,
} from "@/lib/workflow/correction-routes";

type RaiseCorrectionModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDesignId?: string;
  defaultTaskId?: string;
  /** Prefill display context when opener already knows design/task facts */
  defaultIdeaRef?: string;
  defaultCollectionName?: string;
  defaultSourceStageName?: string;
  defaultSourceStageCode?: string;
  defaultSourceRemark?: string;
  defaultAssigneeName?: string;
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

/** Preferred rework targets for the correction loop (capability-driven). */
function suggestedRouteCode(
  sourceCode: string | null | undefined,
  routeCodes: string[],
): string {
  return suggestedCorrectionRouteCode(sourceCode, routeCodes);
}

function buildInitialState(defaultDesignId?: string, defaultTaskId?: string) {
  return {
    designId: defaultDesignId ?? "",
    taskId: defaultTaskId ?? "",
    correctionType: "IMPROVEMENT" as RaiseCorrectionPayload["correctionType"],
    responsibleEmployeeId: "" as number | "",
    routeToSubProcessId: "" as number | "",
    rootCause: "",
    extraMinutes: "",
    extraCost: "",
  };
}

export function RaiseCorrectionModal({
  open,
  onClose,
  defaultDesignId,
  defaultTaskId,
  defaultIdeaRef,
  defaultCollectionName,
  defaultSourceStageName,
  defaultSourceStageCode,
  defaultSourceRemark,
  defaultAssigneeName,
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
  const [routeToSubProcessId, setRouteToSubProcessId] = useState<number | "">("");
  const [rootCause, setRootCause] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [routeSeededFor, setRouteSeededFor] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    const initial = buildInitialState(defaultDesignId, defaultTaskId);
    setDesignId(initial.designId);
    setTaskId(initial.taskId);
    setCorrectionType(initial.correctionType);
    setResponsibleEmployeeId(initial.responsibleEmployeeId);
    setRouteToSubProcessId(initial.routeToSubProcessId);
    setRootCause(initial.rootCause);
    setExtraMinutes(initial.extraMinutes);
    setExtraCost(initial.extraCost);
    setRouteSeededFor("");
    setAttemptedSubmit(false);
  }

  const designQuery = useDesign(designId, open && !!designId);
  const isMistake = correctionType === "MISTAKE";

  const selectedTask = (designQuery.data?.tasks ?? []).find((t) => t.id === taskId);
  const routeOptions = useMemo(() => {
    const tasks = designQuery.data?.tasks ?? [];
    const stages = tasks.map((t) => ({
      code: t.subProcess.code,
      name: t.subProcess.name,
      isCorrectionAllowed: (t.subProcess as { isCorrectionAllowed?: boolean }).isCorrectionAllowed,
      capabilities: (t.subProcess as { capabilities?: unknown }).capabilities,
      status: t.status,
    }));
    const routeCodes = correctionRouteCodesFromStages(stages);
    const byCode = new Map<string, { id: number; name: string; code: string }>();
    for (const t of tasks) {
      const code = t.subProcess.code;
      if (!routeCodes.includes(code)) continue;
      if (!byCode.has(code)) {
        byCode.set(code, { id: t.subProcess.id, name: t.subProcess.name, code });
      }
    }
    return routeCodes
      .map((code) => byCode.get(code))
      .filter((r): r is { id: number; name: string; code: string } => !!r);
  }, [designQuery.data?.tasks]);

  const routeSeedKey = `${designId}:${taskId}:${routeOptions.map((r) => r.id).join(",")}`;
  if (open && routeSeedKey !== routeSeededFor && routeOptions.length > 0 && taskId) {
    setRouteSeededFor(routeSeedKey);
    const suggested = suggestedRouteCode(
      selectedTask?.subProcess.code ?? defaultSourceStageCode,
      routeOptions.map((r) => r.code),
    );
    const match = routeOptions.find((r) => r.code === suggested) ?? routeOptions[0];
    setRouteToSubProcessId(match.id);
  }

  const selectedRoute = routeOptions.find((r) => r.id === routeToSubProcessId);
  const routeTargetTask = (designQuery.data?.tasks ?? []).find(
    (t) => t.subProcess.id === routeToSubProcessId,
  );

  const handoff = useMemo((): HandoffContext => {
    const ideaRef =
      designQuery.data?.ideaRef ?? defaultIdeaRef ?? null;
    const collectionName =
      designQuery.data?.collectionName ?? defaultCollectionName ?? null;
    const stageName =
      selectedTask?.subProcess.name ?? defaultSourceStageName ?? null;
    const stageCode =
      selectedTask?.subProcess.code ?? defaultSourceStageCode ?? null;
    const sourceRemark =
      selectedTask?.outputRemark ?? defaultSourceRemark ?? null;
    const assigneeName =
      selectedTask?.assignedEmployee?.name ?? defaultAssigneeName ?? null;

    let nextStepHint: string | null = null;
    if (selectedRoute) {
      const predicted =
        routeTargetTask?.assignedEmployee?.name ?? null;
      nextStepHint = predicted
        ? `Routes rework to ${selectedRoute.name} → ${predicted}`
        : `Routes rework to ${selectedRoute.name}`;
    } else if (stageName) {
      nextStepHint = "Select a rework stage to route the correction";
    }

    return {
      ideaRef,
      collectionName,
      productType: designQuery.data?.productType?.name ?? null,
      priority: designQuery.data?.priority ?? null,
      stageCode,
      stageName,
      assigneeName,
      status: selectedTask?.status ?? null,
      description:
        "Raises a correction loop from the source stage back into design rework.",
      nextStepHint,
      priorStage:
        stageName || sourceRemark
          ? {
              code: stageCode ?? undefined,
              name: stageName ?? "Source stage",
              status: selectedTask?.status ?? null,
              outputRemark: sourceRemark,
              assigneeName,
            }
          : null,
    };
  }, [
    designQuery.data,
    defaultIdeaRef,
    defaultCollectionName,
    defaultSourceStageName,
    defaultSourceStageCode,
    defaultSourceRemark,
    defaultAssigneeName,
    selectedTask,
    selectedRoute,
    routeTargetTask,
  ]);

  function handleClose() {
    setLoadedKey("closed");
    setAttemptedSubmit(false);
    onClose();
  }

  function handleCorrectionTypeChange(value: RaiseCorrectionPayload["correctionType"]) {
    setCorrectionType(value);
    if (value !== "MISTAKE") {
      setResponsibleEmployeeId("");
    }
  }

  const fieldErrors = {
    designId: !designId ? "Design is required" : undefined,
    taskId: !taskId ? "Source task is required" : undefined,
    routeToSubProcessId: !routeToSubProcessId ? "Rework route is required" : undefined,
    responsibleEmployeeId:
      isMistake && !responsibleEmployeeId ? "Responsible employee is required" : undefined,
    rootCause: !rootCause.trim() ? "Reason / feedback is required" : undefined,
  };

  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (
      fieldErrors.designId ||
      fieldErrors.taskId ||
      fieldErrors.routeToSubProcessId ||
      fieldErrors.responsibleEmployeeId ||
      fieldErrors.rootCause
    ) {
      return;
    }
    await raiseCorrection.mutateAsync({
      designId,
      taskId,
      correctionType,
      responsibleEmployeeId: responsibleEmployeeId ? Number(responsibleEmployeeId) : null,
      routeToSubProcessId: Number(routeToSubProcessId),
      rootCause: rootCause.trim(),
      extraMinutes: extraMinutes.trim() ? Number(extraMinutes) : null,
      extraCost: extraCost.trim() ? Number(extraCost) : null,
    });
    handleClose();
  }

  const canSubmit =
    !!designId &&
    !!taskId &&
    !!rootCause.trim() &&
    !!routeToSubProcessId &&
    (!isMistake || !!responsibleEmployeeId) &&
    !raiseCorrection.isPending;

  return (
    <Modal
      open={open}
      title="Raise Correction"
      onClose={handleClose}
      size="lg"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={handleClose}>
            Cancel
          </AppButton>
          <AppButton type="button" disabled={raiseCorrection.isPending} onClick={handleSubmit}>
            {raiseCorrection.isPending ? "Raising…" : "Raise Correction"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ActionHandoffBanner context={handoff} />

        {!isPrefilled ? (
          <>
            <FormSelect
              id="corrDesign"
              label="Design"
              required
              value={designId || null}
              onValueChange={(v) => {
                setDesignId(v);
                setTaskId("");
                setRouteToSubProcessId("");
                setRouteSeededFor("");
              }}
              options={(designsQuery.data?.items ?? []).map((d) => ({
                value: d.id,
                label: `${d.ideaRef} - ${d.collectionName}`,
              }))}
              placeholder="Select…"
              error={attemptedSubmit ? fieldErrors.designId : undefined}
            />

            <FormSelect
              id="corrTask"
              label="Source task"
              required
              value={taskId || null}
              onValueChange={(v) => {
                setTaskId(v);
                setRouteSeededFor("");
              }}
              options={(designQuery.data?.tasks ?? []).map((t) => ({
                value: t.id,
                label: `${t.process.name} → ${t.subProcess.name} (${t.status})`,
              }))}
              placeholder="Select…"
              disabled={!designId || designQuery.isLoading}
              error={attemptedSubmit ? fieldErrors.taskId : undefined}
            />
          </>
        ) : null}

        <FormSelect
          id="corrRoute"
          label="Route rework to"
          required
          value={routeToSubProcessId === "" ? null : String(routeToSubProcessId)}
          onValueChange={(v) => setRouteToSubProcessId(v ? Number(v) : "")}
          options={routeOptions.map((r) => ({
            value: String(r.id),
            label: r.name,
          }))}
          placeholder="Select…"
          disabled={!designId || routeOptions.length === 0}
          error={attemptedSubmit ? fieldErrors.routeToSubProcessId : undefined}
        />

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
              label: e.name,
            }))}
            placeholder="Select…"
            error={attemptedSubmit ? fieldErrors.responsibleEmployeeId : undefined}
          />
        </ModalFormGrid>

        <ModalFormGrid>
          <FormTextField
            id="corrExtraMinutes"
            label="Extra minutes"
            type="number"
            min={0}
            value={extraMinutes}
            onChange={(e) => setExtraMinutes(e.target.value)}
          />
          <FormTextField
            id="corrExtraCost"
            label="Extra cost"
            type="number"
            min={0}
            step="0.01"
            value={extraCost}
            onChange={(e) => setExtraCost(e.target.value)}
          />
        </ModalFormGrid>

        <FormTextArea
          id="corrRootCause"
          label="Reason / feedback"
          required
          rows={3}
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          onEnterSubmit={canSubmit ? () => void handleSubmit() : undefined}
          error={attemptedSubmit ? fieldErrors.rootCause : undefined}
        />
      </ModalForm>
    </Modal>
  );
}
