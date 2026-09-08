"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AppCard } from "@/components/ui/AppCard";
import { ConceptMediaPanel } from "@/components/ConceptMediaPanel";
import { ImageGallery } from "@/components/ImageGallery";
import { queryKeys } from "@/lib/query-keys";
import type { DesignSummary } from "@/lib/types/api";

type TechArtifact = {
  id?: string;
  artifactType?: string;
  fileName?: string | null;
  machineFormat?: string | null;
  contentType?: string | null;
  storageKey?: string | null;
  downloadUrl?: string | null;
  uploadedAtUtc?: string | null;
};

function TechFileRow({
  label,
  artifact,
}: {
  label: string;
  artifact?: TechArtifact | null;
}) {
  if (!artifact) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-muted-foreground">—</span>
      </div>
    );
  }

  const name =
    artifact.fileName?.trim() ||
    (artifact.machineFormat ? String(artifact.machineFormat) : "File");
  const href = artifact.downloadUrl ?? null;
  const isImage = !!artifact.contentType?.startsWith("image/");

  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="m-0 text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
            download={artifact.fileName ?? undefined}
          >
            {name}
          </a>
        ) : (
          <p className="m-0 font-semibold">{name}</p>
        )}
        {artifact.contentType ? (
          <p className="m-0 mt-0.5 text-xs text-muted-foreground">{artifact.contentType}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {href && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={href}
            alt={name}
            className="size-12 rounded border border-border object-cover"
          />
        ) : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            download={artifact.fileName ?? undefined}
          >
            Download
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function FilesPanel({
  design,
  canUpload,
  highlightImageId = null,
}: {
  design: DesignSummary;
  canUpload?: boolean;
  highlightImageId?: string | null;
}) {
  const queryClient = useQueryClient();
  const images = design.images ?? [];
  const imageCount = images.filter((i) => !i.mediaKind || i.mediaKind === "IMAGE").length;
  const audioCount = images.filter((i) => i.mediaKind === "AUDIO").length;
  const videoCount = images.filter((i) => i.mediaKind === "VIDEO").length;
  const fileCount = images.filter((i) => i.mediaKind === "FILE").length;

  const artifacts = (design.tasks ?? []).flatMap(
    (t) => (t.artifacts ?? []) as TechArtifact[],
  );
  const withFile = (a: TechArtifact) => !!a.storageKey || !!a.downloadUrl;
  const sketch =
    artifacts.find((a) => a.artifactType === "SKETCH_VERSION" && withFile(a)) ??
    artifacts.find((a) => a.artifactType === "SKETCH_VERSION");
  const punching =
    artifacts.find((a) => a.artifactType === "PUNCHING_FILE" && withFile(a)) ??
    artifacts.find((a) => a.artifactType === "PUNCHING_FILE");
  const machine =
    artifacts.find(
      (a) =>
        (a.artifactType === "SAMPLE_OUTPUT" || !!a.machineFormat) && withFile(a),
    ) ??
    artifacts.find((a) => a.artifactType === "SAMPLE_OUTPUT" || !!a.machineFormat);

  async function refreshAfterUpload() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(design.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.images(design.id) }),
    ]);
  }

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
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Other files</dt>
              <dd className="font-semibold">
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </dd>
            </div>
          </dl>
        </AppCard>
        <AppCard title="Technical Files">
          <div className="space-y-3">
            <TechFileRow label="Sketch" artifact={sketch} />
            <TechFileRow label="Wilcom" artifact={punching} />
            <TechFileRow label="Machine" artifact={machine} />
          </div>
        </AppCard>
      </div>

      {canUpload ? (
        <ConceptMediaPanel
          designId={design.id}
          canUpload={canUpload}
          onUploaded={() => void refreshAfterUpload()}
        />
      ) : null}

      <AppCard title="Media library" description="Preview, play, and download concept media.">
        <ImageGallery
          designId={design.id}
          canUpload={!!canUpload}
          showUploader={false}
          highlightImageId={highlightImageId}
        />
      </AppCard>
    </div>
  );
}
