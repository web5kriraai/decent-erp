"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignImageRecord } from "@/lib/types/api";

type TaskCompareVersionsPanelProps = {
  designId: string;
};

function isViewableImage(file: DesignImageRecord) {
  const kind = file.mediaKind ?? "IMAGE";
  return kind === "IMAGE" && file.contentType.startsWith("image/");
}

function byNewest(a: DesignImageRecord, b: DesignImageRecord) {
  return new Date(b.uploadedAtUtc).getTime() - new Date(a.uploadedAtUtc).getTime();
}

function byOldest(a: DesignImageRecord, b: DesignImageRecord) {
  return new Date(a.uploadedAtUtc).getTime() - new Date(b.uploadedAtUtc).getTime();
}

function defaultPair(files: DesignImageRecord[]) {
  const open = files.filter((file) => file.reviewStatus !== "REJECTED");
  const pool = open.length > 0 ? open : files;
  const baseline = pool.find((file) => file.isPrimary) ?? [...pool].sort(byOldest)[0] ?? null;
  const revision = [...pool].sort(byNewest).find((file) => file.id !== baseline?.id) ?? null;
  return { baselineId: baseline?.id ?? "", revisionId: revision?.id ?? "" };
}

function optionLabel(file: DesignImageRecord) {
  const part = file.componentName?.trim() || (file.isPrimary ? "Primary" : "File");
  const flag = file.reviewStatus === "REJECTED" ? " · Not approved" : "";
  return `${part} · ${file.fileName}${flag}`;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CompareFrame({
  file,
  onOpen,
}: {
  file: DesignImageRecord | null;
  onOpen: (file: DesignImageRecord) => void;
}) {
  if (!file) {
    return (
      <div className="version-compare-frame version-compare-frame--empty">
        <p>No file on this side.</p>
      </div>
    );
  }

  if (!isViewableImage(file)) {
    const ext = file.fileName.includes(".")
      ? file.fileName.split(".").pop()?.toUpperCase()
      : "FILE";
    return (
      <div className="version-compare-frame version-compare-frame--empty">
        <p className="version-compare-file-ext">{ext}</p>
        <p>{file.fileName}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="version-compare-frame"
      onClick={() => onOpen(file)}
      aria-label={`View ${file.fileName}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file.downloadUrl} alt={file.fileName} />
    </button>
  );
}

function SideHeading({
  title,
  file,
  files,
  value,
  onChange,
}: {
  title: string;
  file: DesignImageRecord | null;
  files: DesignImageRecord[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="version-compare-side">
      <p className="version-compare-label">{title}</p>
      {files.length > 2 ? (
        <select
          className="form-select form-select--compact"
          value={value}
          aria-label={title}
          onChange={(event) => onChange(event.target.value)}
        >
          {files.map((item) => (
            <option key={item.id} value={item.id}>
              {optionLabel(item)}
            </option>
          ))}
        </select>
      ) : null}
      {file ? (
        <p className="version-compare-caption">
          {file.componentName?.trim() || (file.isPrimary ? "Primary" : "File")}
          {" · "}
          {file.fileName}
          {formatWhen(file.uploadedAtUtc) ? ` · ${formatWhen(file.uploadedAtUtc)}` : ""}
          {file.reviewStatus === "REJECTED" ? " · Not approved" : ""}
        </p>
      ) : (
        <p className="version-compare-caption">Nothing selected</p>
      )}
    </div>
  );
}

export function TaskCompareVersionsPanel({ designId }: TaskCompareVersionsPanelProps) {
  const imagesQuery = useQuery({
    queryKey: queryKeys.designs.images(designId),
    queryFn: () => apiGet<DesignImageRecord[]>(`/api/designs/${designId}/images`),
    enabled: !!designId,
  });
  const files = useMemo(() => imagesQuery.data ?? [], [imagesQuery.data]);
  const [baselineId, setBaselineId] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const [lightbox, setLightbox] = useState<DesignImageRecord | null>(null);

  useEffect(() => {
    if (!files.length) return;
    const ids = new Set(files.map((file) => file.id));
    if (ids.has(baselineId) && (revisionId === "" || ids.has(revisionId))) return;
    const next = defaultPair(files);
    setBaselineId(next.baselineId);
    setRevisionId(next.revisionId);
  }, [files, baselineId, revisionId]);

  const baseline = files.find((file) => file.id === baselineId) ?? null;
  const revision = files.find((file) => file.id === revisionId) ?? null;
  const sameFile = Boolean(baseline && revision && baseline.id === revision.id);

  if (imagesQuery.isLoading) {
    return (
      <section className="version-compare-block" aria-label="Compare versions">
        <p className="version-compare-label">Compare versions</p>
        <p className="text-sm text-muted-foreground m-0">Loading design files…</p>
      </section>
    );
  }

  if (imagesQuery.isError) {
    return (
      <section className="version-compare-block" aria-label="Compare versions">
        <p className="version-compare-label">Compare versions</p>
        <p className="text-sm text-destructive m-0" role="alert">
          Could not load design files.
        </p>
      </section>
    );
  }

  if (files.length === 0) {
    return (
      <section className="version-compare-block" aria-label="Compare versions">
        <p className="version-compare-label">Compare versions</p>
        <p className="text-sm text-muted-foreground m-0">No files uploaded yet.</p>
      </section>
    );
  }

  return (
    <section className="version-compare-block" aria-label="Compare versions">
      <p className="version-compare-label">Compare versions</p>
      {files.length === 1 ? (
        <div className="version-compare version-compare--single">
          <SideHeading
            title="Only file"
            file={files[0]}
            files={files}
            value={files[0].id}
            onChange={() => undefined}
          />
          <CompareFrame file={files[0]} onOpen={setLightbox} />
          <p className="version-compare-note">
            Only one file is on this design, so there is no second version to compare.
          </p>
        </div>
      ) : (
        <>
          {sameFile ? (
            <p className="version-compare-note" role="status">
              Choose two different files to compare.
            </p>
          ) : null}
          <div className="version-compare">
            <div className="version-compare-col">
              <SideHeading
                title="Baseline"
                file={baseline}
                files={files}
                value={baselineId}
                onChange={setBaselineId}
              />
              <CompareFrame file={baseline} onOpen={setLightbox} />
            </div>
            <div className="version-compare-col">
              <SideHeading
                title="Latest revision"
                file={revision}
                files={files}
                value={revisionId}
                onChange={setRevisionId}
              />
              <CompareFrame file={revision} onOpen={setLightbox} />
            </div>
          </div>
        </>
      )}
      <ImageLightboxModal
        open={!!lightbox && isViewableImage(lightbox)}
        onClose={() => setLightbox(null)}
        imageUrl={lightbox?.downloadUrl}
        title={lightbox?.fileName ?? "Design file"}
      />
    </section>
  );
}
