import { IconLock } from "@/components/icons";

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
        <h2 className="empty-state-title">Access restricted</h2>
        <p className="empty-state-desc">
          {message ??
            (permission
              ? `You need the ${permission.replace(/_/g, " ")} permission to view this section. Contact your administrator if you believe this is an error.`
              : "You do not have access to this section.")}
        </p>
      </div>
    </div>
  );
}
