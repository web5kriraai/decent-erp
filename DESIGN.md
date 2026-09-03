---
version: "1.1"
name: Decent-Technologies-ERP
description: Light-theme enterprise ERP for Decent Technologies. Navy (#172747) primary; white sidebar; crimson accent. Brand assets in public/brand; favicons in public/favicon. Paths via @/config/brand-assets. No dark app canvas.
colors:
  primary: "#172747"
  primary-hover: "#243a5c"
  primary-pressed: "#0f1a2e"
  primary-soft: "#e8ecf2"
  accent: "#d91a22"
  accent-hover: "#c1222e"
  accent-soft: "#FDE9EA"
  navy: "#172747"
  on-primary: "#ffffff"
  canvas: "#F5F6F8"
  surface: "#ffffff"
  ink: "#172747"
  muted: "#64748b"
  border: "#dce3ec"
  success: "#1b6e3a"
  warning: "#9a6700"
  danger: "#a41a24"
  info: "#026aa7"
typography:
  fontFamily: Inter, Roboto, system-ui, sans-serif
  h1: 24px semibold
  h2: 18px semibold
  body: 14px regular
  caption: 12px regular
  kpi: 20–28px semibold tabular-nums
radius:
  sm: 4px
  md: 6px
  lg: 8px
logo:
  path: /brand/logo.png
  mark: /brand/logo-mark.png
  file: public/brand/logo.png
  faviconDir: public/favicon
---

# Decent Technologies — ERP Design System (Light)

**Read this file before any UI work.** Match these tokens, type scale, and component patterns. Theme is **light only**.

## Brand overview

Decent ERP uses a **standard enterprise** color model derived from the logo:

- **Deep navy** `#172747` — **primary** (buttons, links, focus, headers, sidebar, body ink)
- **Crimson** `#d91a22` — **accent only** (active-nav rail, charts, logo highlights — not page-wide CTAs)
- Supporting reds `#c1222e` / `#a41a24` — accent hover / **destructive** only

Do **not** flood the UI with crimson primary buttons. Do **not** use SAP blue, purple gradients, or a dark app canvas.

## Logo

| Context | Usage |
|---------|--------|
| Asset | `/brand/logo.png` full; `/brand/logo-mark.png` monogram |
| Login brand panel | Mark on navy panel |
| Sidebar | Mark + “Decent ERP” text on white (no black box) |
| Sidebar collapsed | Mark only |
| Favicon | `/favicon/favicon.ico`, `favicon-16/32.png`, `icon.png`, `apple-touch-icon.png` (+ root `/favicon.ico`) |

**Rule:** use `@/config/brand-assets` paths — never hardcode asset URLs in features.

## Color tokens (CSS variables)

| Token | Hex | Usage |
|-------|-----|--------|
| `--color-primary` | `#172747` | Primary buttons, links, focus ring |
| `--color-primary-hover` | `#243a5c` | Hover |
| `--color-primary-pressed` | `#0f1a2e` | Pressed |
| `--color-primary-light` | `#e8ecf2` | Soft selected fills, focus halo |
| `--color-navy` / `--color-primary-dark` | `#172747` | Headers, emphasis |
| `--color-accent` | `#d91a22` | Nav active rail, chart accent, brand sparks |
| `--color-accent-soft` | `#FDE9EA` | Rare soft accent chip |
| `--color-sidebar-bg` | `#ffffff` | Light sidebar chrome (separate from logo) |
| `--color-logo-plate` | `#000000` | Only surface behind logo.png / login brand panel |
| `--color-page-canvas` | `#F5F6F8` | Page background |
| `--color-surface` | `#FFFFFF` | Cards / tables |
| `--color-danger` | `#a41a24` | Reject / validation |
| Success / warning / info | greens / amber / info blue | Status only |

ShadCN: `--primary` → navy; `--destructive` → `#a41a24`; `--sidebar-primary` → crimson accent; charts navy → crimson → muted.

## Components

| Pattern | Spec |
|---------|------|
| Primary button | Solid navy `#172747`, white text; hover `#243a5c` |
| Secondary | Soft `#e8ecf2` / outline |
| Destructive | `#a41a24` only |
| Active nav | Light white wash on navy sidebar + **crimson** 3px rail |
| Focus ring | Navy |
| Kanban lanes | Cool navy-tint greys — not pink |
| Login | Navy brand panel + light form; navy submit |

## Do / Don’t

**Do:** CSS variables; light canvas; logo on login/sidebar/favicon; crimson sparingly as accent.

**Don’t:** Crimson as default CTA; hardcode SAP blues; dark-mode flip; purple AI themes.

## Iteration

Update this frontmatter → `globals.css` `:root` → `.cursor/rules/02-design-theme.mdc`.
