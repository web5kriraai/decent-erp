"use client";

import { AppCard } from "@/components/ui/AppCard";
import { ConceptMediaPanel } from "@/components/ConceptMediaPanel";
import type { DesignSummary } from "@/lib/types/api";

export function FilesPanel({
  design,
  canUpload,
}: {
  design: DesignSummary;
  canUpload?: boolean;
}) {
  const images = design.images ?? [];
  const imageCount = images.filter((i) => !i.mediaKind || i.mediaKind === "IMAGE").length;
  const audioCount = images.filter((i) => i.mediaKind === "AUDIO").length;
  const videoCount = images.filter((i) => i.mediaKind === "VIDEO").length;

  const artifacts = (design.tasks ?? []).flatMap((t) => t.artifacts ?? []);
  const sketch = artifacts.find((a) => a.artifactType === "SKETCH_VERSION");
  const punching = artifacts.find((a) => a.artifactType === "PUNCHING_FILE");
  const machine = artifacts.find(
    (a) => a.artifactType === "SAMPLE_OUTPUT" || a.machineFormat,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <AppCard title="Reference Media">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Images</dt>
              <dd className="font-semibold">
                {imageCount} {imageCount === 1 ? "file" : "files"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Voice Notes</dt>
              <dd className="font-semibold">
                {audioCount} {audioCount === 1 ? "file" : "files"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Videos</dt>
              <dd className="font-semibold">
                {videoCount} {videoCount === 1 ? "file" : "files"}
              </dd>
            </div>
          </dl>
        </AppCard>
        <AppCard title="Technical Files">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sketch</dt>
              <dd className="font-semibold">{sketch?.fileName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Wilcom</dt>
              <dd className="font-semibold">{punching?.fileName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Machine</dt>
              <dd className="font-semibold">
                {machine?.fileName ??
                  (machine?.machineFormat ? String(machine.machineFormat) : "—")}
              </dd>
            </div>
          </dl>
        </AppCard>
      </div>
      {canUpload ? (
        <ConceptMediaPanel designId={design.id} canUpload={canUpload} />
      ) : null}
    </div>
  );
}
