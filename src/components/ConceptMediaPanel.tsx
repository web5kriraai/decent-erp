"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { FileUploader } from "@/components/FileUploader";
import { AudioRecorder } from "@/components/AudioRecorder";
import type { PendingConceptMedia } from "@/lib/concept-media-upload";

type ConceptMediaPanelProps = {
  designId?: string;
  canUpload?: boolean;
  components?: Array<{ id: string; label: string }>;
  onUploaded?: () => void;
  /** Create-form queue mode. */
  queueMode?: boolean;
  pendingItems?: PendingConceptMedia[];
  onPendingChange?: (items: PendingConceptMedia[]) => void;
  /** When false, only show uploader/recorder (gallery rendered separately). */
  showIntro?: boolean;
  /** Compact layout for side column on create form. */
  compact?: boolean;
  /** When true, intro copy stresses that a product image is required. */
  requiredImage?: boolean;
  error?: string;
};

type PanelTab = "upload" | "record";

export function ConceptMediaPanel({
  designId,
  canUpload = true,
  components,
  onUploaded,
  queueMode = false,
  pendingItems = [],
  onPendingChange,
  showIntro = true,
  compact = false,
  requiredImage = false,
  error,
}: ConceptMediaPanelProps) {
  const [tab, setTab] = useState<PanelTab>("upload");

  if (!canUpload) return null;

  return (
    <div className={compact ? "vstack vstack--tight" : "vstack vstack--loose"}>
      {showIntro ? (
        <p className="m-0 text-sm text-[var(--color-neutral-600)]">
          {requiredImage
            ? "Upload at least one product image (required). You can also add other files or a voice note."
            : "Attach files or record a voice note. Type is detected automatically."}
        </p>
      ) : null}

      <div className="flex w-full flex-wrap gap-2">
        <AppButton
          type="button"
          size="sm"
          appVariant={tab === "upload" ? "primary" : "secondary"}
          onClick={() => setTab("upload")}
        >
          Upload
        </AppButton>
        <AppButton
          type="button"
          size="sm"
          appVariant={tab === "record" ? "primary" : "secondary"}
          onClick={() => setTab("record")}
        >
          Record voice
        </AppButton>
      </div>

      {tab === "upload" ? (
        <FileUploader
          designId={designId}
          autoDetectMediaKind
          showComponentSelect={!!components?.length}
          components={components}
          onUploaded={onUploaded}
          queueMode={queueMode}
          pendingItems={pendingItems}
          onPendingChange={onPendingChange}
          multiple
        />
      ) : (
        <AudioRecorder
          designId={designId}
          onUploaded={onUploaded}
          queueMode={queueMode}
          onQueued={(item) => {
            if (!onPendingChange) return;
            onPendingChange([...pendingItems, item]);
          }}
        />
      )}

      {error ? (
        <span className="form-error text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
