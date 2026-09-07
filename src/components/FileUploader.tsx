"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { FormSelect } from "@/components/ui/form-select";
import { useApiToast } from "@/components/ui/ToastProvider";
import type { ConceptMediaKind } from "@/lib/file-upload-policy";
import {
  acceptForAllConceptMedia,
  acceptForConceptMedia,
  limitLabelForMediaKind,
  validateConceptMediaClient,
} from "@/lib/file-upload-policy";
import {
  createPendingMediaId,
  inferMediaKindFromFile,
  type PendingConceptMedia,
  uploadConceptMediaFile,
} from "@/lib/concept-media-upload";

type FileUploaderProps = {
  /** When set, uploads immediately to the design. */
  designId?: string;
  onUploaded?: () => void;
  disabled?: boolean;
  /** Fixed kind when autoDetect is false. Ignored when autoDetectMediaKind is true. */
  mediaKind?: ConceptMediaKind;
  designComponentId?: string | null;
  /** Show optional component link select. */
  showComponentSelect?: boolean;
  components?: Array<{ id: string; label: string }>;
  /** Infer IMAGE/AUDIO/VIDEO/FILE from each file (default true). */
  autoDetectMediaKind?: boolean;
  /** Queue mode for create form — do not upload yet. */
  queueMode?: boolean;
  pendingItems?: PendingConceptMedia[];
  onPendingChange?: (items: PendingConceptMedia[]) => void;
  multiple?: boolean;
};

function resolveKind(file: File, autoDetect: boolean, fixed: ConceptMediaKind): ConceptMediaKind {
  return autoDetect ? inferMediaKindFromFile(file) : fixed;
}

export function FileUploader({
  designId,
  onUploaded,
  disabled,
  mediaKind: mediaKindProp = "IMAGE",
  designComponentId: designComponentIdProp = null,
  showComponentSelect = false,
  components,
  autoDetectMediaKind = true,
  queueMode = false,
  pendingItems = [],
  onPendingChange,
  multiple = true,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useApiToast();
  const [uploading, setUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [designComponentId, setDesignComponentId] = useState<string | null>(
    designComponentIdProp,
  );

  useEffect(() => {
    setDesignComponentId(designComponentIdProp);
  }, [designComponentIdProp]);

  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length || !onPendingChange) return;
      const next = [...pendingItems];
      for (const file of list) {
        const kind = resolveKind(file, autoDetectMediaKind, mediaKindProp);
        const preflight = validateConceptMediaClient(file, kind);
        if (!preflight.ok) {
          toast.error(
            preflight.status === 413 ? "File too large" : "Invalid file",
            preflight.message,
          );
          continue;
        }
        const previewUrl =
          kind === "IMAGE" || kind === "VIDEO" || kind === "AUDIO"
            ? URL.createObjectURL(file)
            : undefined;
        next.push({
          id: createPendingMediaId(),
          file,
          mediaKind: kind,
          isPrimary:
            kind === "IMAGE" && !next.some((p) => p.mediaKind === "IMAGE" && p.isPrimary),
          previewUrl,
        });
      }
      onPendingChange(next);
    },
    [autoDetectMediaKind, mediaKindProp, onPendingChange, pendingItems, toast],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!designId) return;
      const list = Array.from(files);
      if (!list.length) return;

      setUploading(true);
      setUploadTotal(list.length);
      setUploadIndex(0);
      let ok = 0;
      try {
        for (let i = 0; i < list.length; i++) {
          const file = list[i];
          setUploadIndex(i + 1);
          const kind = resolveKind(file, autoDetectMediaKind, mediaKindProp);
          const preflight = validateConceptMediaClient(file, kind);
          if (!preflight.ok) {
            toast.error(
              preflight.status === 413 ? "File too large" : "Invalid file",
              preflight.message,
            );
            continue;
          }
          const componentId = showComponentSelect
            ? designComponentId
            : designComponentIdProp;
          await uploadConceptMediaFile({
            designId,
            file,
            mediaKind: kind,
            designComponentId: componentId,
          });
          ok += 1;
        }
        if (ok > 0) {
          toast.success(
            ok === 1 ? "File uploaded" : `${ok} files uploaded`,
            ok === 1 ? list[0]?.name : undefined,
          );
          onUploaded?.();
        }
      } catch (error) {
        toast.errorFromApi(error, "Upload failed");
      } finally {
        setUploading(false);
        setUploadIndex(0);
        setUploadTotal(0);
      }
    },
    [
      autoDetectMediaKind,
      designComponentId,
      designComponentIdProp,
      designId,
      mediaKindProp,
      onUploaded,
      showComponentSelect,
      toast,
    ],
  );

  function handleFiles(files: FileList | null) {
    if (!files?.length || disabled || uploading) return;
    if (queueMode) {
      enqueueFiles(files);
      return;
    }
    void uploadFiles(files);
  }

  function removePending(id: string) {
    if (!onPendingChange) return;
    const target = pendingItems.find((p) => p.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    const next = pendingItems.filter((p) => p.id !== id);
    if (
      target?.mediaKind === "IMAGE" &&
      target.isPrimary &&
      !next.some((p) => p.mediaKind === "IMAGE" && p.isPrimary)
    ) {
      const firstImage = next.find((p) => p.mediaKind === "IMAGE");
      if (firstImage) firstImage.isPrimary = true;
    }
    onPendingChange([...next]);
  }

  function setPendingPrimary(id: string) {
    if (!onPendingChange) return;
    onPendingChange(
      pendingItems.map((p) => ({
        ...p,
        isPrimary: p.mediaKind === "IMAGE" ? p.id === id : false,
      })),
    );
  }

  const accept = autoDetectMediaKind
    ? acceptForAllConceptMedia()
    : acceptForConceptMedia(mediaKindProp);
  const limitHint = autoDetectMediaKind
    ? "per file limits apply"
    : `max ${limitLabelForMediaKind(mediaKindProp)}`;

  return (
    <div className="vstack vstack--tight w-full">
      {showComponentSelect && components && components.length > 0 ? (
        <FormSelect
          id="upload-component"
          label="Link to component"
          value={designComponentId}
          onValueChange={(v) => setDesignComponentId(v || null)}
          options={[
            { value: "", label: "Design-level (no component)" },
            ...components.map((c) => ({ value: c.id, label: c.label })),
          ]}
          placeholder="Optional"
        />
      ) : null}

      <div
        className={`file-uploader${dragOver ? " file-uploader--drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (!disabled && !uploading) inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled && !uploading) inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="m-0 text-sm text-[var(--color-neutral-600)]">
          {uploading
            ? `Uploading ${uploadIndex}/${uploadTotal}…`
            : `Drag & drop files here, or click to browse (${limitHint})`}
        </p>
      </div>
      {uploading && uploadTotal > 0 ? (
        <div
          className="w-full"
          role="progressbar"
          aria-valuenow={uploadIndex}
          aria-valuemin={0}
          aria-valuemax={uploadTotal}
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round((uploadIndex / uploadTotal) * 100)}%`,
              height: "100%",
              background: "var(--color-primary)",
              transition: "width 0.2s ease",
            }}
          />
        </div>
      ) : null}

      {queueMode && pendingItems.length > 0 ? (
        <div
          className="grid w-full gap-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          }}
        >
          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="rounded border border-[var(--border)] bg-[var(--card)] p-2"
              style={{
                outline:
                  item.isPrimary && item.mediaKind === "IMAGE"
                    ? "2px solid var(--color-primary)"
                    : undefined,
              }}
            >
              {item.mediaKind === "IMAGE" && item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  style={{
                    width: "100%",
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 3,
                  }}
                />
              ) : item.mediaKind === "VIDEO" && item.previewUrl ? (
                <video
                  src={item.previewUrl}
                  style={{ width: "100%", height: 80, objectFit: "cover" }}
                />
              ) : item.mediaKind === "AUDIO" && item.previewUrl ? (
                <audio controls src={item.previewUrl} className="w-full" />
              ) : (
                <div
                  className="flex items-center justify-center text-xs text-[var(--color-neutral-600)]"
                  style={{ height: 80, background: "var(--muted)" }}
                >
                  {item.mediaKind}
                </div>
              )}
              <p className="mt-1 mb-0 truncate text-xs" title={item.file.name}>
                {item.file.name}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {item.mediaKind === "IMAGE" && !item.isPrimary ? (
                  <AppButton
                    type="button"
                    size="sm"
                    appVariant="ghost"
                    onClick={() => setPendingPrimary(item.id)}
                  >
                    Primary
                  </AppButton>
                ) : null}
                {item.isPrimary && item.mediaKind === "IMAGE" ? (
                  <span className="badge">Primary</span>
                ) : null}
                <AppButton
                  type="button"
                  size="sm"
                  appVariant="ghost"
                  onClick={() => removePending(item.id)}
                >
                  Remove
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
