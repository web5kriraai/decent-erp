"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppCard } from "@/components/ui/AppCard";
import { ConceptMediaPanel } from "@/components/ConceptMediaPanel";
import { ImageGallery } from "@/components/ImageGallery";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
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
  onViewImage,
}: {
  label: string;
  artifact?: TechArtifact | null;
  onViewImage?: (url: string, title: string) => void;
}) {
  if (!artifact) {
    return (
      <article className="file-slot">
        <p className="file-slot-label">{label}</p>
        <p className="file-slot-empty">Not uploaded yet</p>
      </article>
    );
  }

  const name =
    artifact.fileName?.trim() ||
    (artifact.machineFormat ? String(artifact.machineFormat) : "File");
  const href = artifact.downloadUrl ?? null;
  const isImage = !!artifact.contentType?.startsWith("image/");

  return (
    <article className="file-slot">
      <p className="file-slot-label">{label}</p>
      {href && isImage ? (
        <button
          type="button"
          className="file-slot-preview"
          title="View full image"
          aria-label={`View ${name}`}
          onClick={() => onViewImage?.(href, name)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt={name} />
        </button>
      ) : null}
      {href && isImage && onViewImage ? (
        <button type="button" className="file-slot-name" onClick={() => onViewImage(href, name)}>
          {name}
        </button>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="file-slot-name"
          download={artifact.fileName ?? undefined}
        >
          {name}
        </a>
      ) : (
        <p className="file-slot-name">{name}</p>
      )}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="file-slot-download"
          download={artifact.fileName ?? undefined}
        >
          Download
        </a>
      ) : (
        <p className="file-slot-empty">File is recorded, but not available to open.</p>
      )}
    </article>
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
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(
    null,
  );
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

  const mediaSummary = [
    `${imageCount} ${imageCount === 1 ? "image" : "images"}`,
    `${audioCount} ${audioCount === 1 ? "voice note" : "voice notes"}`,
    `${videoCount} ${videoCount === 1 ? "video" : "videos"}`,
    `${fileCount} ${fileCount === 1 ? "other file" : "other files"}`,
  ].join(" · ");

  return (
    <div className="space-y-4">
      <AppCard
        title="Photos and notes"
        description={mediaSummary}
      >
        <ImageGallery
          designId={design.id}
          canUpload={!!canUpload}
          showUploader={false}
          showActions={false}
          highlightImageId={highlightImageId}
          components={(design.components ?? []).map((component) => ({
            id: component.id,
            label: component.componentType?.name ?? "Component",
          }))}
        />
      </AppCard>

      {canUpload ? (
        <ConceptMediaPanel
          designId={design.id}
          canUpload={canUpload}
          onUploaded={() => void refreshAfterUpload()}
        />
      ) : null}

      <AppCard
        title="Stage files"
        description="Sketch, Wilcom punch file, and machine output. Each one appears after that stage uploads it."
      >
        <div className="file-slot-grid">
          <TechFileRow
            label="Sketch"
            artifact={sketch}
            onViewImage={(url, title) => setLightbox({ url, title })}
          />
          <TechFileRow
            label="Wilcom"
            artifact={punching}
            onViewImage={(url, title) => setLightbox({ url, title })}
          />
          <TechFileRow
            label="Machine"
            artifact={machine}
            onViewImage={(url, title) => setLightbox({ url, title })}
          />
        </div>
      </AppCard>

      <ImageLightboxModal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        imageUrl={lightbox?.url}
        title={lightbox?.title ?? "Design image"}
      />
    </div>
  );
}
