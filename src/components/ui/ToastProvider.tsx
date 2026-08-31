"use client";

import { ApiClientError } from "@/lib/api-client";
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
    setTimeout(() => dismissToast(id), 6000);
  }, [dismissToast]);

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-container"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            role="alert"
          >
            <div className="toast-content">
              <p className="toast-title">{toast.title}</p>
              {toast.message && <p className="toast-message">{toast.message}</p>}
              {toast.correlationId && (
                <p className="toast-correlation">ID: {toast.correlationId}</p>
              )}
            </div>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
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
    errorFromApi: (error: unknown, fallback = "Something went wrong") => {
      if (error instanceof ApiClientError) {
        showToast({
          type: "error",
          title: error.message || fallback,
          message:
            error.isConflict
              ? "Refresh the page and try again."
              : error.isValidationError
                ? "Check the form fields and retry."
                : undefined,
          correlationId: error.correlationId,
        });
        return;
      }
      showToast({ type: "error", title: fallback });
    },
  };
}
