# Redesign — Deferred & Cut Features

This ledger tracks features relative to the 2026-06 app redesign (1:1 re-port from
`design_handoff_goalforge/`). The redesign covered the foundation + 5 signed-in app pages
(Dashboard, Analytics, Logs, Chat, Settings). Decide keep/cut for the **Deferred** items
after the redesign settles.

Spec: `docs/superpowers/specs/2026-06-20-app-redesign-1to1-design.md`
Plan: `docs/superpowers/plans/2026-06-20-app-redesign-1to1.md`

## Deferred — KEPT in the codebase (not surfaced or only partially surfaced by the new design)

These remain fully wired. The handoff design didn't cover them; they were not removed.

| Feature | Key file(s) | Status after redesign |
|---|---|---|
| Trophy Room / collection | `src/components/CollectionModal.tsx` (opened from `AppHeader`/`Layout`) | Kept; still reachable from header |
| Reward modal | `src/components/RewardModal.tsx` | Kept |
| Star Shop | `src/components/StarShop.tsx` | Kept — surfaced on the redesigned Logs page |
| Energy modal + low-energy resize | `src/components/EnergyModal.tsx`, `EnergyParamCapture.tsx` | Kept; TodayBar action retained |
| Focus mode overlay | `src/components/FocusOverlay.tsx` | Kept; TodayBar action retained |
| Goal heatmap | `src/components/GoalHeatmap.tsx` | Kept in codebase; NOT on the redesigned Analytics (handoff has its own SVG heatmap) |
| Mini calendar | `src/components/MiniCalendar.tsx` | Kept in codebase; not surfaced on redesigned pages |
| Weekly reflection / review | `src/hooks/useWeeklyReflection.ts`, `useWeeklyReview.ts` | Kept — reflection card retained on redesigned Analytics |
| Install prompt (PWA) | `src/components/InstallPrompt.tsx` | Kept |
| Offline banner | `src/components/OfflineBanner.tsx` | Kept |
| Push notifications | `src/hooks/usePushNotifications.ts`, push settings | Kept — surfaced on redesigned Settings |

## Cut — DECIDED to remove (2026-06-20), currently only UI-HIDDEN (reversible)

These were decided as cut by the user. The redesign **stops surfacing them** in the UI, but
the code/backend are intentionally still present — the destructive deletion (incl. a DB
migration) is a separate, explicitly user-gated teardown task (NOT part of the visual re-port).

| Feature | Key file(s) | Current state |
|---|---|---|
| **CompanionWidget** ("tamagotchi bubble") | `src/components/CompanionWidget.tsx` (+ `companion-pulse` CSS, removed) | Removed from Dashboard render; component file kept |
| **Accountability partners** | `src/hooks/useAccountability.ts` + backend accountability routes/model | Removed from Settings UI; hook file + backend untouched |

**Gated teardown (do NOT run without explicit user go-ahead):** delete the CompanionWidget +
useAccountability files, remove backend accountability routes/model + the `GET /overview`
`invitee_user_id`/`target_email` match, and run an Alembic migration dropping the accountability
table. See Task 8 in the plan.

## Header chrome — hidden pending post-redesign re-integration (2026-06-21)

The following header elements are hidden in the new `gf-header` shell (phase 2 shell rebuild) but remain fully wired in the codebase. No code was deleted — just not rendered.

| Element | Where | Notes |
|---|---|---|
| Trophy Room / relic-count button | `AppHeader.tsx` (was `relicCount > 0 && onOpenCollection`) | `CollectionModal` still mounted in `Layout.tsx`; `onOpenCollection` prop still on `AppHeaderProps` |
| Equipped-title badge | `AppHeader.tsx` (was `equippedTitle` chip) | `useRewardsQuery` still runs for the theme effect |
| First-name text | `AppHeader.tsx` (was `user.firstName` span) | Clerk `user` object still available |

Re-introduce when post-redesign header chrome pass is scheduled.

## 2026-07-04 full rebuild (plan `2026-07-04-full-redesign-rebuild.md`) — running additions

| Feature | Decision | Code lives at | Keep/cut recommendation |
|---|---|---|---|
| Equipped reward themes (body class from purchased theme, e.g. `theme-neon-cyberpunk`) | HIDDEN — old `AppHeader.tsx` applied it; new `AppShell.tsx` (Task 0) does not; CSS kept in LEGACY block of `index.css`; `useRewardsQuery` intact | `src/hooks/useRewards.ts`, legacy theme classes in `src/index.css` | Cut — conflicts with the locked prototype look (accent/theme are fixed by design); revisit only if shop keeps cosmetic items |

Note (Task 0): rows in earlier sections referencing `AppHeader.tsx`/`Layout.tsx` are stale — both files were deleted in the rebuild; ledger gets a full rewrite in Task 9.

## Out of scope (separate later redesign passes)

- **Onboarding** (`src/pages/Onboarding.tsx`) — handoff `app/GoalForge Onboarding.html`.
- **Landing page** (`src/pages/LandingPage.tsx`) — handoff `landing/GoalForge Landing.html` (warm palette).
