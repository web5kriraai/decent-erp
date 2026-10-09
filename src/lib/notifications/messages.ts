const SUBJECTS: Record<string, string> = {
  TASK_ASSIGNED: "Task assigned to you",
  CORRECTION_RAISED: "Correction raised",
  PRODUCTION_RELEASED: "Design released to production",
  PRODUCTION_HANDOFF_ACCEPTED: "Production handoff accepted",
  PRODUCTION_RETURN_CLARIFICATION: "Production returned for clarification",
  TASK_COMPLETED: "Task completed",
  DESIGN_CREATED: "New design created",
  TASK_DUE_SOON: "Task due soon",
  TASK_OVERDUE: "Task overdue",
  MATERIAL_HOLD: "Waiting for material",
  MACHINE_HOLD: "Machine not available",
  APPROVAL_PENDING: "Approval pending",
  DESIGN_APPROVED: "Design approved",
  ERP_HANDOFF_SYNCED: "ERP handoff synced",
  ERP_HANDOFF_FAILED: "ERP handoff failed",
};

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function payloadText(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = textValue(payload[key]);
    if (value) return value;
  }
  return null;
}

function formatWhen(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function designLabel(payload: Record<string, unknown>): string {
  const idea = payloadText(payload, "ideaRef", "collectionName", "designNumber");
  return idea ? `Design ${idea}` : "This design";
}

/** Plain-language sentence for an in-app notification. */
export function describeNotification(
  eventType: string,
  payload: Record<string, unknown>,
): string {
  const design = designLabel(payload);
  const due = formatWhen(payloadText(payload, "dueAt"));
  const stage = payloadText(payload, "stageName", "subProcessName", "taskName");

  switch (eventType) {
    case "TASK_OVERDUE":
      return due
        ? `${design}${stage ? ` (${stage})` : ""} is overdue. It was due ${due}.`
        : `${design} is past its due date.`;
    case "TASK_DUE_SOON":
      return due
        ? `${design}${stage ? ` (${stage})` : ""} is due ${due}.`
        : `${design} is due soon.`;
    case "TASK_ASSIGNED":
      return stage
        ? `${stage} on ${design} is now assigned to you.`
        : `A task on ${design} is now assigned to you.`;
    case "TASK_COMPLETED":
      return stage ? `${stage} on ${design} is complete.` : `A task on ${design} is complete.`;
    case "CORRECTION_RAISED":
      return `A correction was raised on ${design}.`;
    case "APPROVAL_PENDING":
      return `${design} is waiting for approval.`;
    case "DESIGN_APPROVED":
      return `${design} is approved for production.`;
    case "DESIGN_CREATED":
      return `${design} was created.`;
    case "PRODUCTION_RELEASED":
      return `${design} was released to production.`;
    case "PRODUCTION_HANDOFF_ACCEPTED":
      return `Production accepted the handoff for ${design}.`;
    case "PRODUCTION_RETURN_CLARIFICATION":
      return `Production sent ${design} back for clarification.`;
    case "MATERIAL_HOLD":
      return `${design} is on hold until material is available.`;
    case "MACHINE_HOLD":
      return `${design} is on hold because the machine is not available.`;
    case "ERP_HANDOFF_SYNCED":
      return `${design} was synced to the ERP.`;
    case "ERP_HANDOFF_FAILED":
      return `${design} could not be synced to the ERP.`;
    default:
      return SUBJECTS[eventType] ?? "You have a new update.";
  }
}

/** Older rows stored `Event: TASK_OVERDUE` plus raw payload lines. */
export function notificationDescription(body: string): string {
  const trimmed = body.trim();
  if (!trimmed.startsWith("Event:")) return trimmed;
  const lines = trimmed.split("\n");
  const eventType = lines[0].replace(/^Event:\s*/, "").trim();
  const payload: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const splitAt = line.indexOf(":");
    if (splitAt <= 0) continue;
    payload[line.slice(0, splitAt).trim()] = line.slice(splitAt + 1).trim();
  }
  return describeNotification(eventType, payload);
}

export function buildNotificationMessage(
  eventType: string,
  payload: Record<string, unknown>,
): { subject: string; text: string; html: string } {
  const subject = SUBJECTS[eventType] ?? "Decent ERP update";
  const text = describeNotification(eventType, payload);
  const html = `<p><strong>${subject}</strong></p><p>${text}</p>`;
  return { subject, text, html };
}
