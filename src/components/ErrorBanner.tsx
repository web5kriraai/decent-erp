type ErrorBannerProps = {
  message: string;
  correlationId?: string;
  onRetry?: () => void;
};

export function ErrorBanner({ message, correlationId, onRetry }: ErrorBannerProps) {
  return (
    <div className="alert alert-error" role="alert">
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{message}</p>
        {correlationId && (
          <p style={{ margin: "0.25rem 0 0", fontSize: "var(--font-size-caption)", opacity: 0.85 }}>
            Correlation ID: <code>{correlationId}</code>
          </p>
        )}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
