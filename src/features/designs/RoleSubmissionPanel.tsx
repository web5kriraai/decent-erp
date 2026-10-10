"use client";

import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatTaskStamp } from "@/lib/task-action-display";
import type { DesignSummary, DesignTask } from "@/lib/types/api";

function artifactFacts(artifact: NonNullable<DesignTask["artifacts"]>[number]) {
  const bits = [
    artifact.stitchCount != null ? `${artifact.stitchCount.toLocaleString("en-IN")} stitches` : null,
    artifact.machineFormat,
    artifact.needleCount != null ? `${artifact.needleCount} needles` : null,
    artifact.colorCount != null ? `${artifact.colorCount} colors` : null,
    artifact.hoopSize ? `Hoop ${artifact.hoopSize}` : null,
    artifact.softwareName,
    artifact.sampleQty != null ? `${artifact.sampleQty} pcs` : null,
    artifact.wastageQty != null && artifact.wastageQty > 0
      ? `${artifact.wastageQty} wastage`
      : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function fileLabel(artifact: NonNullable<DesignTask["artifacts"]>[number]) {
  return artifact.fileName?.trim() || artifact.artifactType?.replaceAll("_", " ") || "File";
}

export function RoleSubmissionPanel({ design }: { design: DesignSummary }) {
  const tasks = [...(design.tasks ?? [])].sort((a, b) => a.sequence - b.sequence);
  const conceptFiles = (design.images ?? []).filter((image) => image.fileName || image.downloadUrl);

  if (tasks.length === 0 && conceptFiles.length === 0) return null;

  return (
    <AppCard
      title="What each role submitted"
      description="Role, person, submit time, what they sent, and every file on this design."
    >
      <div className="space-y-4">
        {conceptFiles.length > 0 ? (
          <section className="space-y-2" aria-label="Concept files">
            <p className="m-0 text-sm font-medium text-foreground">Concept files</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {conceptFiles.map((image) => (
                <li key={image.id}>
                  {image.downloadUrl ? (
                    <a
                      href={image.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="file-slot-download"
                    >
                      {image.fileName || "File"}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">{image.fileName || "File"}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ol className="task-stage-list">
          {tasks.map((task) => {
            const role = task.subProcess?.defaultRole?.name ?? "Role not set";
            const person = task.assignedEmployee?.name ?? "Unassigned";
            const submittedAt = formatTaskStamp(task.completedAt);
            const remark = task.outputRemark?.trim() || null;
            const artifacts = task.artifacts ?? [];
            const facts = artifacts
              .map((artifact) => artifactFacts(artifact))
              .filter(Boolean);
            const files = artifacts.filter(
              (artifact) => artifact.fileName || artifact.downloadUrl || artifact.storageKey,
            );

            return (
              <li key={task.id} className="task-stage-row">
                <span className="task-stage-row__step" aria-hidden>
                  {task.sequence}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="task-stage-row__title">{task.subProcess?.name ?? "Stage"}</p>
                  <p className="task-stage-row__meta">
                    {role} · {person}
                  </p>
                  <p className="task-stage-row__meta">
                    {submittedAt ? `Submitted ${submittedAt}` : "Not submitted yet"}
                  </p>
                  {remark ? <p className="task-stage-row__note">{remark}</p> : null}
                  {facts.map((fact) => (
                    <p className="task-stage-row__note" key={fact}>
                      {fact}
                    </p>
                  ))}
                  {files.length > 0 ? (
                    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                      {files.map((artifact, index) => {
                        const label = fileLabel(artifact);
                        return (
                          <li key={artifact.id ?? `${task.id}-${index}`}>
                            {artifact.downloadUrl ? (
                              <a
                                href={artifact.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="file-slot-download"
                                download={artifact.fileName ?? undefined}
                              >
                                {label}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">{label}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : task.subProcess?.isFileRequired ? (
                    <p className="task-stage-row__meta">No file on this stage</p>
                  ) : null}
                </div>
                <StatusBadge status={task.status} />
              </li>
            );
          })}
        </ol>
      </div>
    </AppCard>
  );
}
