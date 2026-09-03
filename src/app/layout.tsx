import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { FAVICON_ASSETS } from "@/config/brand-assets";
import { APP_DEFAULT_DESCRIPTION, APP_NAME } from "@/config/page-metadata";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Design Management`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DEFAULT_DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: [
      { url: FAVICON_ASSETS.ico, sizes: "any" },
      { url: FAVICON_ASSETS.icoRoot, sizes: "any" },
      { url: FAVICON_ASSETS.icon, type: "image/png", sizes: "32x32" },
      { url: FAVICON_ASSETS.png16, sizes: "16x16", type: "image/png" },
      { url: FAVICON_ASSETS.png32, sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: FAVICON_ASSETS.apple, sizes: "180x180", type: "image/png" }],
    shortcut: FAVICON_ASSETS.ico,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full", inter.variable)}>
      <body className="min-h-full antialiased font-[family-name:var(--font-family-base)]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
