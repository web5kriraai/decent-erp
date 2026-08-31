"use client";

import { Providers } from "@/components/Providers";
import { ToastProvider } from "@/components/ui/ToastProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <ToastProvider>{children}</ToastProvider>
    </Providers>
  );
}
