/**
 * Canonical public asset paths for Decent Technologies branding.
 * Files live under public/brand and public/favicon.
 */
export const BRAND_ASSETS = {
  logo: "/brand/logo.png",
  logoMark: "/brand/logo-mark.png",
  logoOnBlack: "/brand/logo-on-black.png",
} as const;

export const FAVICON_ASSETS = {
  ico: "/favicon/favicon.ico",
  /** Root copy for browsers that request /favicon.ico by default */
  icoRoot: "/favicon.ico",
  png16: "/favicon/favicon-16.png",
  png32: "/favicon/favicon-32.png",
  icon: "/favicon/icon.png",
  apple: "/favicon/apple-touch-icon.png",
  icon512: "/favicon/icon-512.png",
} as const;
