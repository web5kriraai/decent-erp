"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useDesignsList } from "@/hooks/use-designs";
import { useDesign } from "@/hooks/use-designs";
import { useEmployeeOptions, useRaiseCorrection } from "@/hooks/use-corrections";
import type { RaiseCorrectionPayload } from "@/hooks/use-corrections";

type RaiseCorrectionModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDesignId?: string;
};

export function RaiseCorrectionModal({ open, onClose, defaultDesignId }: RaiseCorrectionModalProps) {
  const designsQuery = useDesignsList(open);
  const employeesQuery = useEmployeeOptions(open);
  const raiseCorrection = useRaiseCorrection();

  const [designId, setDesignId] = useState(defaultDesignId ?? "");
  const [taskId, setTaskId] = useState("");
  const [correctionType, setCorrectionType] =
    useState<RaiseCorrectionPayload["correctionType"]>("MISTAKE");
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<number | "">("");
  const [rootCause, setRootCause] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [extraCost, setExtraCost] = useState("");

  const designQuery = useDesign(designId, open && !!designId);
  const tasks = designQuery.data?.tasks ?? [];

  useEffect(() => {
    if (open && defaultDesignId) setDesignId(defaultDesignId);
  }, [open, defaultDesignId]);

  useEffect(() => {
    setTaskId("");
  }, [designId]);

  async function handleSubmit() {
    if (!designId || !taskId || !responsibleEmployeeId) return;
    await raiseCorrection.mutateAsync({
      designId,
      taskId,
      correctionType,
      responsibleEmployeeId: Number(responsibleEmployeeId),
      rootCause: rootCause.trim() || undefined,
      extraMinutes: extraMinutes ? Number(extraMinutes) : undefined,
      extraCost: extraCost ? Number(extraCost) : undefined,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Raise Correction"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !designId ||
              !taskId ||
              !responsibleEmployeeId ||
              raiseCorrection.isPending
            }
            onClick={handleSubmit}
          >
            Raise Correction
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="corrDesign">
          Design *
        </label>
        <select
          id="corrDesign"
          className="form-select"
          value={designId}
          onChange={(e) => setDesignId(e.target.value)}
        >
          <option value="">Select design…</option>
          {designsQuery.data?.items.map((d) => (
            <option key={d.id} value={d.id}>
              {d.ideaRef} — {d.collectionName}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="corrTask">
          Task *
        </label>
        <select
          id="corrTask"
          className="form-select"
          value={taskId}
          disabled={!designId || designQuery.isLoading}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">Select task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.process.name} → {t.subProcess.name} ({t.status})
            </option>
          ))}
        </select>
      </div>

      <div className="form-grid form-grid--2">
        <div className="form-group">
          <label className="form-label" htmlFor="corrType">
            Type *
          </label>
          <select
            id="corrType"
            className="form-select"
            value={correctionType}
            onChange={(e) =>
              setCorrectionType(e.target.value as RaiseCorrectionPayload["correctionType"])
            }
          >
            <option value="MISTAKE">Mistake</option>
            <option value="IMPROVEMENT">Improvement</option>
            <option value="CUSTOMER_CHANGE">Customer Change</option>
            <option value="MACHINE_MATERIAL_ISSUE">Machine / Material Issue</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="corrResponsible">
            Responsible Employee *
          </label>
          <select
            id="corrResponsible"
            className="form-select"
            value={responsibleEmployeeId}
            onChange={(e) =>
              setResponsibleEmployeeId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Select employee…</option>
            {employeesQuery.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.employeeCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="corrRootCause">
          Root Cause
        </label>
        <textarea
          id="corrRootCause"
          className="form-textarea"
          rows={2}
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
        />
      </div>

      <div className="form-grid form-grid--2">
        <div className="form-group">
          <label className="form-label" htmlFor="corrMinutes">
            Extra Minutes
          </label>
          <input
            id="corrMinutes"
            type="number"
            className="form-input"
            min={0}
            value={extraMinutes}
            onChange={(e) => setExtraMinutes(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="corrCost">
            Extra Cost
          </label>
          <input
            id="corrCost"
            type="number"
            className="form-input"
            min={0}
            step="0.01"
            value={extraCost}
            onChange={(e) => setExtraCost(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
