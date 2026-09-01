export function buildNotificationMessage(
  eventType: string,
  payload: Record<string, unknown>,
): { subject: string; text: string; html: string } {
  const subjectMap: Record<string, string> = {
    TASK_ASSIGNED: "Task assigned to you",
    CORRECTION_RAISED: "Correction raised",
    PRODUCTION_RELEASED: "Design released to production",
    PRODUCTION_HANDOFF_ACCEPTED: "Production handoff accepted",
    PRODUCTION_RETURN_CLARIFICATION: "Production return for clarification",
    TASK_COMPLETED: "Task completed",
    DESIGN_CREATED: "New design created",
    TASK_DUE_SOON: "Task due soon",
    TASK_OVERDUE: "Task overdue",
    APPROVAL_PENDING: "Approval pending",
    ERP_HANDOFF_SYNCED: "ERP handoff synced",
    ERP_HANDOFF_FAILED: "ERP handoff failed",
  };

  const subject = subjectMap[eventType] ?? `Decent ERP: ${eventType}`;
  const lines = [`Event: ${eventType}`, ...Object.entries(payload).map(([k, v]) => `${k}: ${v}`)];
  const text = lines.join("\n");
  const html = `<p><strong>${subject}</strong></p><ul>${Object.entries(payload)
    .map(([k, v]) => `<li>${k}: ${String(v)}</li>`)
    .join("")}</ul>`;

  return { subject, text, html };
}
