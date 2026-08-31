import type { ReactNode } from "react";
import { IconEmpty } from "@/components/icons";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon ?? <IconEmpty size={28} />}</div>
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
