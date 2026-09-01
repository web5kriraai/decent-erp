"use client";

import { ApiClientError } from "@/lib/api-client";
import { humanizeApiError } from "@/lib/humanize-api-error";
import { cn } from "@/lib/utils";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
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
  correlationId?: string;
};

type ToastContextValue = {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS: Record<ToastType, typeof CheckCircle2Icon> = {
  success: CheckCircle2Icon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
      setTimeout(() => dismissToast(id), 7000);
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
              role="alert"
            >
              <span className="toast-icon" aria-hidden>
                <Icon className="size-5" />
              </span>
              <div className="toast-content">
                <p className="toast-title">{toast.title}</p>
                {toast.message ? <p className="toast-message">{toast.message}</p> : null}
                {toast.correlationId ? (
                  <p className="toast-correlation">Reference: {toast.correlationId}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
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
      showToast({
        type: "error",
        title: humanized.title,
        message: humanized.hint,
        correlationId: humanized.correlationId,
      });
    },
  };
}
