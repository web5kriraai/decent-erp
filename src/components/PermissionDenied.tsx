import { IconLock } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { accessRestrictedMessage } from "@/lib/user-messages";

type PermissionDeniedProps = {
  permission?: string;
  message?: string;
};

export function PermissionDenied({ permission, message }: PermissionDeniedProps) {
  return (
    <EmptyState
      title="This area isn't open for your role"
      description={message ?? accessRestrictedMessage(permission)}
      icon={<IconLock size={28} />}
    />
  );
}
