import { IconLock } from "@/components/icons";

type PermissionDeniedProps = {
  permission: string;
};

export function PermissionDenied({ permission }: PermissionDeniedProps) {
  return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon">
          <IconLock size={28} />
        </div>
        <h2 className="empty-state-title">Access restricted</h2>
        <p className="empty-state-desc">
          You need the <strong>{permission.replace(/_/g, " ")}</strong> permission to
          view this section. Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}
