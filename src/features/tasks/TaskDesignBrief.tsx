"use client";

import { useState } from "react";
import { AppCard } from "@/components/ui/AppCard";
import {
  DesignerTimePanel,
  earlierDesignerStages,
} from "@/components/tasks/DesignerTimePanel";
import {
  hasPriorPunchingDetails,
  PunchingDetailsFacts,
} from "@/components/tasks/PunchingDetailsFacts";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { WORK_TYPE_OPTIONS, type TaskTimeDetail } from "@/lib/types/api";
import { formatTaskDeadline, formatTaskStamp, resolveTaskAssignedAt } from "@/lib/task-action-display";

function fact(value?: string | null) {
  const text = value?.trim();
  return text ? text : "-";
}

function workTypeLabel(code?: string | null) {
  if (!code) return "-";
  return WORK_TYPE_OPTIONS.find((option) => option.value === code)?.label ?? code;
}

export function TaskDesignBrief({
  task,
}: {
  task: TaskTimeDetail;
}) {
  const design = task.design;
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const components = design.components ?? [];
  const stages = task.workflowPeers ?? [];
  const isCosting = task.subProcess.code === "COSTING";
  const designerStages = isCosting
    ? earlierDesignerStages(stages, { id: task.id, sequence: task.sequence })
    : [];

  return (
    <>
      <AppCard title="Design">
        <div className="task-brief">
          <button
            type="button"
            className="task-brief__photo"
            disabled={!design.primaryImageUrl}
            onClick={() => {
              if (!design.primaryImageUrl) return;
              setLightbox({
                url: design.primaryImageUrl,
                title: design.ideaRef,
              });
            }}
          >
            {design.primaryImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img src={design.primaryImageUrl} alt="" />
            ) : (
              <span>{fact(design.productType)}</span>
            )}
          </button>
          <dl className="design-detail-facts">
            <div>
              <dt>Design number</dt>
              <dd>{fact(design.designNumber)}</dd>
            </div>
            <div>
              <dt>Collection</dt>
              <dd>{fact(design.collectionName)}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{fact(design.productType)}</dd>
            </div>
            <div>
              <dt>Fabric</dt>
              <dd>{fact(design.fabric || design.materialFabric)}</dd>
            </div>
            <div>
              <dt>Stitching</dt>
              <dd>
                {fact(
                  design.stitchingType ||
                    (task.priorPunching?.stitchCount != null
                      ? `${task.priorPunching.stitchCount.toLocaleString()} stitches`
                      : null),
                )}
              </dd>
            </div>
            <div>
              <dt>Machine</dt>
              <dd>{fact(design.machine || task.priorPunching?.machineFormat)}</dd>
            </div>
            <div>
              <dt>Season</dt>
              <dd>{fact(design.season)}</dd>
            </div>
            <div>
              <dt>Style</dt>
              <dd>{fact(design.styleName)}</dd>
            </div>
            <div>
              <dt>Work type</dt>
              <dd>{workTypeLabel(design.workType)}</dd>
            </div>
            <div>
              <dt>Trend</dt>
              <dd>{fact(design.trendReference)}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{fact(design.celebrityReference)}</dd>
            </div>
            <div>
              <dt>Grade</dt>
              <dd>{fact(design.designGrade)}</dd>
            </div>
            <div>
              <dt>Design head</dt>
              <dd>{fact(design.designHead)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{fact(design.location)}</dd>
            </div>
            <div>
              <dt>Target end</dt>
              <dd>{formatTaskDeadline(design.targetEndDate) ?? "-"}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                {design.priority ? <PriorityBadge priority={design.priority} /> : "-"}
              </dd>
            </div>
            <div className="task-brief__note">
              <dt>Concept note</dt>
              <dd>{fact(design.conceptNote)}</dd>
              {task.instructionNote?.trim() &&
              task.instructionNote.trim() !== design.conceptNote?.trim() ? (
                <>
                  <dt>Stage instruction</dt>
                  <dd>{task.instructionNote.trim()}</dd>
                </>
              ) : null}
            </div>
          </dl>
        </div>
      </AppCard>

      {isCosting ? (
        <AppCard
          title="Designer time"
          description="Active work already recorded on earlier stages. Use this total when you enter the time cost."
        >
          <DesignerTimePanel stages={designerStages} />
        </AppCard>
      ) : null}

      {hasPriorPunchingDetails(task.priorPunching) && task.priorPunching ? (
        <AppCard
          title="Punching / Wilcom"
          description={
            task.priorPunching.recordedByName
              ? `Recorded by ${task.priorPunching.recordedByName}`
              : "Recorded by the punching designer."
          }
        >
          <PunchingDetailsFacts details={task.priorPunching} />
        </AppCard>
      ) : null}

      {(task.priorWorkFiles ?? []).length > 0 ? (
        <AppCard
          title="Earlier work"
          description="Files submitted on the stages before this one."
        >
          <div className="file-slot-grid">
            {(task.priorWorkFiles ?? []).map((file) => {
              const isImage = !!file.contentType?.startsWith("image/");
              const href = file.downloadUrl;
              return (
                <article key={file.id} className="file-slot">
                  <p className="file-slot-label">{file.stageName}</p>
                  {href && isImage ? (
                    <button
                      type="button"
                      className="file-slot-preview file-slot-preview--fit"
                      title="View full image"
                      aria-label={`View ${file.fileName}`}
                      onClick={() => setLightbox({ url: href, title: file.fileName })}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                      <img src={href} alt={file.fileName} />
                    </button>
                  ) : null}
                  {href && isImage ? (
                    <button
                      type="button"
                      className="file-slot-name"
                      onClick={() => setLightbox({ url: href, title: file.fileName })}
                    >
                      {file.fileName}
                    </button>
                  ) : href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="file-slot-name"
                      download={file.fileName}
                    >
                      {file.fileName}
                    </a>
                  ) : (
                    <p className="file-slot-name">{file.fileName}</p>
                  )}
                  {file.uploadedByName ? (
                    <p className="file-slot-empty">Submitted by {file.uploadedByName}</p>
                  ) : null}
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="file-slot-download"
                      download={file.fileName}
                    >
                      Download
                    </a>
                  ) : (
                    <p className="file-slot-empty">File is recorded, but not available to open.</p>
                  )}
                </article>
              );
            })}
          </div>
        </AppCard>
      ) : null}

      <AppCard title="Components">
        {components.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">No components on this design.</p>
        ) : (
          <div className="component-view-grid">
            {components.map((component) => (
              <article key={component.id} className="component-view-card">
                <p className="component-view-name">{component.name}</p>
                {component.specification?.trim() ? (
                  <p className="m-0 text-xs text-muted-foreground">{component.specification.trim()}</p>
                ) : null}
                {component.images.length === 0 ? (
                  <div className="component-view-empty">No image for this component.</div>
                ) : (
                  <div className="component-view-photos">
                    {component.images.map((photo) =>
                      photo.downloadUrl ? (
                        <button
                          key={photo.id}
                          type="button"
                          className="component-view-photo"
                          onClick={() =>
                            setLightbox({
                              url: photo.downloadUrl!,
                              title: `${component.name} · ${photo.fileName}`,
                            })
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                          <img src={photo.downloadUrl} alt={component.name} />
                        </button>
                      ) : null,
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </AppCard>

      <AppCard title="Stages">
        <ol className="task-stage-list">
          {stages.map((stage) => {
            const current = stage.id === task.id;
            const assigned = formatTaskStamp(
              resolveTaskAssignedAt({
                startedAt: stage.startedAt,
                updatedAtUtc: stage.updatedAtUtc,
              }),
            );
            return (
              <li
                key={stage.id}
                className={current ? "task-stage-row task-stage-row--current" : "task-stage-row"}
              >
                <span className="task-stage-row__step" aria-hidden>
                  {stage.sequence}
                </span>
                <div className="min-w-0">
                  <p className="task-stage-row__title">
                    {stage.subProcess.name}
                    {current ? <span className="task-stage-row__you">Your task</span> : null}
                  </p>
                  <p className="task-stage-row__meta">
                    {[stage.subProcess.defaultRole?.name, stage.assignedEmployee?.name]
                      .filter(Boolean)
                      .join(" · ") || "Unassigned"}
                  </p>
                  <p className="task-stage-row__meta">
                    Assigned {assigned ?? "-"} · Deadline {formatTaskDeadline(stage.dueAt) ?? "not set"}
                  </p>
                  {stage.outputRemark?.trim() ? (
                    <p className="task-stage-row__note">{stage.outputRemark.trim()}</p>
                  ) : null}
                </div>
                <StatusBadge status={stage.status} />
              </li>
            );
          })}
        </ol>
      </AppCard>

      <ImageLightboxModal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        imageUrl={lightbox?.url}
        title={lightbox?.title ?? design.ideaRef}
        description={design.collectionName}
      />
    </>
  );
}
