---
'@gigadrive/harmony': minor
---

Add a first-party `@gigadrive/harmony/theme` entry point (`ThemeProvider` + `useTheme`) with a `next-themes`-compatible API, replacing the `next-themes` dependency.

The anti-FOUC script is injected via Next's `useServerInsertedHTML`, so it lands in the SSR `<head>` and is never part of the client React tree — eliminating React 19.2's "Encountered a script tag while rendering React component" warning while preserving FOUC prevention, class/`data-*` toggling on `<html>`, `localStorage` persistence, `system` preference resolution, cross-tab sync, and `disableTransitionOnChange`.

Harmony's `Toaster` now consumes this provider instead of `next-themes`. `next` is declared as an optional peer dependency — only `@gigadrive/harmony/theme` requires it; the rest of the library (including `Toaster`/`useTheme`) stays framework-agnostic.
