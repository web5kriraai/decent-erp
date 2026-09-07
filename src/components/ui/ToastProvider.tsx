"use client";

import { ApiClientError } from "@/lib/api-client";
import { humanizeApiError } from "@/lib/humanize-api-error";
import { cn } from "@/lib/utils";
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconInfo,
  IconXCircle,
  IconClose,
} from "@/components/icons";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  /** Only for unexpected server failures (5xx). */
  correlationId?: string;
};

type ToastContextValue = {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS: Record<ToastType, typeof IconCheckCircle2> = {
  success: IconCheckCircle2,
  error: IconXCircle,
  warning: IconAlertTriangle,
  info: IconInfo,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      const ms = toast.type === "error" ? 6000 : toast.type === "warning" ? 5500 : 4000;
      setTimeout(() => dismissToast(id), ms);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.type];
          return (
            <div
              key={toast.id}
              className={cn("toast", `toast--${toast.type}`)}
              role={toast.type === "error" ? "alert" : "status"}
            >
              <span className={cn("toast-icon", `toast-icon--${toast.type}`)} aria-hidden>
                <Icon className="size-4" />
              </span>
              <div className="toast-content">
                <p className="toast-title">{toast.title}</p>
                {toast.message ? <p className="toast-message">{toast.message}</p> : null}
                {toast.correlationId ? (
                  <p className="toast-correlation">Support ref · {toast.correlationId.slice(0, 8)}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <IconClose className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function useApiToast() {
  const { showToast } = useToast();

  return {
    success: (title: string, message?: string) =>
      showToast({ type: "success", title, message }),
    error: (title: string, message?: string) =>
      showToast({ type: "error", title, message }),
    warning: (title: string, message?: string) =>
      showToast({ type: "warning", title, message }),
    info: (title: string, message?: string) =>
      showToast({ type: "info", title, message }),
    errorFromApi: (error: unknown, fallback = "Something went wrong") => {
      const humanized = humanizeApiError(error, fallback);
      const status = error instanceof ApiClientError ? error.status : 500;
      const isConflict = error instanceof ApiClientError && error.isConflict;
      // Expected business validation → calm warning, not a red error banner.
      const type: ToastType =
        status >= 500 ? "error" : status === 409 || status === 422 || status === 400
          ? "warning"
          : status >= 400
            ? "warning"
            : "error";
      showToast({
        type,
        title: humanized.title,
        message:
          humanized.hint ??
          (isConflict ? "Refresh the page and try again." : undefined),
        correlationId: humanized.correlationId,
      });
    },
  };
}
