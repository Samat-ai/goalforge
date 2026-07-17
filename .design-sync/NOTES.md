# design-sync notes — GoalForge

- **App repo, not a library**: `apps/web` is a Vite SPA with no dist entry. The sync bundles from the hand-authored barrel `apps/web/ds-sync.entry.mjs` (cfg.entry) — exactly the 14 scoped presentational components. Keep the barrel in step with `componentSrcMap` when scope changes.
- **CSS**: `cfg.buildCmd` runs the app build then concats `dist/assets/*.css` → `dist/ds-styles.css` (Vite hashes filenames, so cssEntry needs the stable copy). The compiled app CSS is the truth: tokens + all `gf-*` classes + Tailwind utilities.
- **Converter deps pinned in `.ds-sync/`**: `typescript@5.9.3` (npm's latest resolves to TS 7.0.2 whose JS API breaks package-validate's import probe → silently skips the .d.ts parse check) and `playwright@1.58.2` (must pin the browser build cached at `%LOCALAPPDATA%\ms-playwright\chromium-1208`).
- **Known render warns** (triaged legitimate):
  - `[TOKENS_MISSING] --dx --dy --rot --cc --c --lvl --sz --sc` — all runtime-set inline vars (confetti particles, focus-card accent, onboarding stage strip). Expected-absent.
- **Preview harness paints body white**; GoalForge is dark-first with page background on `body`/`.gf-root` (overridden by the harness). Authored previews wrap every cell in a `.gf-root`-classed dark surface div (`background: var(--bg)`, padding, radius) so cards read on-brand.
- **Solly mascot art is not syncable**: components hardcode public paths (`/solly/*.svg|png|webm`) that don't resolve in the design app — `SollyIdle` and `SollySuggestion` excluded for this reason. Revisit only if assets ever become importable.
- **Excluded components**: GoalCard/AppShell/CoachRail/CoachDrawer/EnergyModal/FocusOverlay (data/hook-coupled), SiteHeader/SiteFooter (Router+Clerk providers), OfflineBanner/InstallPrompt (event-driven, render null statically). PuffyStar is module-private inside GoalCard.tsx (not exported — candidate if ever exported).
- **Fonts**: self-hosted latin subsets in `.design-sync/fonts/` (downloaded from Google Fonts css2, OFL licensed), wired via `cfg.extraFonts`. Weights: Space Grotesk 400–700, Hanken Grotesk 400–800, JetBrains Mono 400–600, Instrument Serif 400 + italic.

- **Headless capture never ticks the CSS animation/transition clock** (animations report `running` at `currentTime: 0` forever). Any entrance-animated component captures at its hidden first frame. Fixes used: `<style>{'.gf-jkp-scrim,.gf-jkp{animation:none!important}'}</style>` pins in modal preview Frames; `window.__gfRevealOff = true` (app-native) for Reveal; `fromRatio={1}` for Ring. Apply the same pattern to any future animated preview.
- **`cardMode: "single"` review sheets show non-primary cells blank** — capture crops from the single-story page where they aren't mounted. Verify those cells with a direct `?story=<Export>` playwright probe before grading; the blank sheet slice is a harness artifact, not a render failure.
- **Fixed-position overlays escape per-cell capture** — wrap the cell in a `transform: translateZ(0)` Frame (containing-block trick) so each cell contains its own scrim.
- **`resync.mjs` validate stage can flake transiently** (exit 1 once, clean on rerun with identical bundle) — rerun once before debugging.

## Re-sync risks

- The barrel + componentSrcMap are hand-maintained twins — a component added to one but not the other either drops it or fails the build.
- `dist/ds-styles.css` goes stale if the app builds without the concat step — always use cfg.buildCmd, not bare `npm run build`.
- Downloaded font files are committed; if brand fonts change in `index.html`, re-run the download and refresh `.design-sync/fonts/`.
- `.ds-sync/` dep pins above are recreated on fresh clones — re-pin exact versions or the TS-7 skip returns silently.
