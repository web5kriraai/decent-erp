"use client";

import { type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconClose } from "@/components/icons";
import { cn } from "@/lib/utils";

type RightDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width classes for the panel. */
  widthClassName?: string;
  className?: string;
};

/**
 * Right-docked detail panel so the dashboard stays visible on the left.
 * Esc closes; outside click does not dismiss (same as Modal).
 */
export function RightDrawer({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName = "w-full sm:max-w-xl md:max-w-2xl lg:max-w-[42rem] xl:max-w-[48rem]",
  className,
}: RightDrawerProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      disablePointerDismissal
      modal="trap-focus"
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/20 supports-backdrop-filter:backdrop-blur-[1px]" />
        <DialogPrimitive.Popup
          data-slot="right-drawer"
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-dvh max-h-dvh w-full flex-col overflow-hidden",
            "border-l border-border bg-card text-sm text-card-foreground shadow-2xl outline-none",
            "duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right",
            widthClassName,
            className,
          )}
        >
          <DialogHeader className="shrink-0 gap-1 border-b border-border px-4 py-3 pr-12 sm:px-5 sm:py-4">
            <DialogTitle className="text-left text-base sm:text-lg">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-left">{description}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-6 sm:px-5 sm:py-4">
            {children}
          </div>

          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3 size-8 text-muted-foreground hover:text-foreground"
                size="icon-sm"
              />
            }
          >
            <IconClose />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
