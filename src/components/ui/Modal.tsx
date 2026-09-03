"use client";

import { type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  size?: "sm" | "md" | "lg" | "xl";
  description?: string;
};

const sizeClasses = {
  // Fluid dialog widths — always leave margin on phone; grow on tablet/desktop
  sm: "max-w-[calc(100%-1.5rem)] sm:max-w-lg",
  md: "max-w-[calc(100%-1.5rem)] sm:max-w-2xl",
  lg: "max-w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-4xl",
  xl: "max-w-[calc(100%-1.5rem)] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl",
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
        className={cn(
          "max-h-[min(92dvh,56rem)] gap-0 p-0",
          sizeClasses[size],
        )}
        showCloseButton
      >
        <DialogHeader className="shrink-0 gap-1 border-b border-border px-4 py-3 pr-12 sm:px-5 sm:py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-5 sm:px-5 sm:py-4 sm:pb-6">
          {children}
        </div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Standard vertical spacing for modal form fields. */
export function ModalForm({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

/** Responsive form grid inside modals — 1 col phone, 2 col tablet+, never 3 by default. */
export function ModalFormGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>
  );
}

/** Right-aligned footer button row. */
export function ModalFooterActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col-reverse gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:justify-end sm:gap-2">
      {children}
    </div>
  );
}

type ModalAlertVariant = "warning" | "info" | "error";

const alertVariants: Record<ModalAlertVariant, string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100",
  info: "border-primary/20 bg-primary/5 text-foreground",
  error: "border-destructive/30 bg-destructive/5 text-destructive",
};

export function ModalAlert({
  variant = "warning",
  children,
}: {
  variant?: ModalAlertVariant;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5 text-sm leading-relaxed",
        alertVariants[variant],
      )}
      role="alert"
    >
      {children}
    </div>
  );
}

export function ModalSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || description || action ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            ) : null}
            {description ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
