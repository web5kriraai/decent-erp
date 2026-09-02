import { AppButton } from "@/components/ui/AppButton";

type ErrorBannerProps = {
  message: string;
  correlationId?: string;
  onRetry?: () => void;
};

export function ErrorBanner({ message, correlationId, onRetry }: ErrorBannerProps) {
  return (
    <div className="alert alert-error" role="alert">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium">{message}</p>
        {correlationId ? (
          <p className="mt-1 text-xs opacity-85">
            Reference: <code>{correlationId}</code>
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <AppButton type="button" appVariant="secondary" size="sm" onClick={onRetry}>
          Retry
        </AppButton>
      ) : null}
    </div>
  );
}
