import type { ReactNode } from "react";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("workSamples");

export default function SampleWorkbenchLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
