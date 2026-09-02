"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  ListTree,
  Pencil,
  Plus,
  Power,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { AppButton, type AppButtonVariant } from "@/components/ui/AppButton";
import { cn } from "@/lib/utils";

export type TableIconActionKind =
  | "edit"
  | "editSteps"
  | "clone"
  | "activate"
  | "deactivate"
  | "reactivate"
  | "add"
  | "remove"
  | "close"
  | "moveUp"
  | "moveDown"
  | "review"
  | "requestApproval"
  | "adjustTime";

const ACTION_META: Record<
  TableIconActionKind,
  { label: string; icon: ReactNode; appVariant?: AppButtonVariant }
> = {
  edit: { label: "Edit", icon: <Pencil aria-hidden />, appVariant: "ghost" },
  editSteps: { label: "Edit steps", icon: <ListTree aria-hidden />, appVariant: "ghost" },
  clone: { label: "Clone as new version", icon: <Copy aria-hidden />, appVariant: "ghost" },
  activate: {
    label: "Activate",
    icon: <CheckCircle2 aria-hidden />,
    appVariant: "secondary",
  },
  deactivate: {
    label: "Deactivate",
    icon: <Ban aria-hidden />,
    appVariant: "outline",
  },
  reactivate: {
    label: "Reactivate",
    icon: <Power aria-hidden />,
    appVariant: "secondary",
  },
  add: { label: "Add", icon: <Plus aria-hidden />, appVariant: "secondary" },
  remove: { label: "Remove", icon: <Trash2 aria-hidden />, appVariant: "ghost" },
  close: { label: "Close", icon: <X aria-hidden />, appVariant: "ghost" },
  moveUp: { label: "Move up", icon: <ChevronUp aria-hidden />, appVariant: "ghost" },
  moveDown: { label: "Move down", icon: <ChevronDown aria-hidden />, appVariant: "ghost" },
  review: { label: "Review", icon: <ClipboardCheck aria-hidden />, appVariant: "primary" },
  requestApproval: {
    label: "Request approval",
    icon: <Send aria-hidden />,
    appVariant: "primary",
  },
  adjustTime: { label: "Adjust time", icon: <Clock aria-hidden />, appVariant: "ghost" },
};

type TableIconActionProps = Omit<ComponentProps<typeof AppButton>, "children" | "size"> & {
  action: TableIconActionKind;
  /** Overrides default accessible name / tooltip. */
  label?: string;
};

/** Compact icon-only table row action with tooltip (title) + aria-label. */
export function TableIconAction({
  action,
  label,
  appVariant,
  className,
  title,
  "aria-label": ariaLabel,
  ...props
}: TableIconActionProps) {
  const meta = ACTION_META[action];
  const name = label ?? meta.label;

  return (
    <AppButton
      type="button"
      size="icon-sm"
      appVariant={appVariant ?? meta.appVariant ?? "ghost"}
      className={cn("table-icon-action", className)}
      title={title ?? name}
      aria-label={ariaLabel ?? name}
      {...props}
    >
      {meta.icon}
    </AppButton>
  );
}

type TableIconActionGroupProps = {
  children: ReactNode;
  className?: string;
};

export function TableIconActionGroup({ children, className }: TableIconActionGroupProps) {
  return <div className={cn("table-icon-actions", className)}>{children}</div>;
}
