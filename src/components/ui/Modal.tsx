"use client";

import { type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  description?: string;
};

const sizeClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

/**
 * Accessible dialog wrapper: Esc closes, Tab focus trap, outside click does NOT dismiss.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
  description,
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      disablePointerDismissal
      modal="trap-focus"
    >
      <DialogContent
        className={cn("gap-0 p-0", sizeClasses[size])}
        showCloseButton
        aria-describedby={description ? "modal-description" : undefined}
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p id="modal-description" className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </DialogHeader>
        <div className="max-h-[min(70vh,36rem)] overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <DialogFooter className="border-t bg-muted/30 px-4 py-3">{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
