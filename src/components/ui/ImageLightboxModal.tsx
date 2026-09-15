"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImageLightboxModalProps = {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null | undefined;
  title?: string;
  description?: string;
};

/**
 * In-page full-image viewer (same tab). Used by workflow/sample kanban cards.
 * Outside click / Esc closes.
 */
export function ImageLightboxModal({
  open,
  onClose,
  imageUrl,
  title = "Design image",
  description,
}: ImageLightboxModalProps) {
  const hasImage = Boolean(imageUrl);

  return (
    <Dialog
      open={open && hasImage}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      modal="trap-focus"
    >
      <DialogContent
        className="image-lightbox-dialog max-h-[min(94dvh,56rem)] max-w-[calc(100%-1rem)] gap-0 p-0 sm:max-w-[min(96vw,56rem)]"
        showCloseButton
      >
        <DialogHeader className="shrink-0 gap-1 border-b border-border px-4 py-3 pr-12 sm:px-5 sm:py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="image-lightbox-body">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs
            <img src={imageUrl} alt={title} className="image-lightbox-img" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
