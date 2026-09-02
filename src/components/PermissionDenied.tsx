import { IconLock } from "@/components/icons";
import { accessRestrictedMessage } from "@/lib/user-messages";

type PermissionDeniedProps = {
  permission?: string;
  message?: string;
};

export function PermissionDenied({ permission, message }: PermissionDeniedProps) {
  return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon">
          <IconLock size={28} />
        </div>
        <h2 className="empty-state-title">This area isn&apos;t open for your role</h2>
        <p className="empty-state-desc">{message ?? accessRestrictedMessage(permission)}</p>
      </div>
    </div>
  );
}
