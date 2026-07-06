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

## Removed (Task 8, 2026-07-05)

**CompanionWidget** ("tamagotchi bubble") and **Accountability partners** were fully deleted:
FE (`useAccountability.ts` + its export, `AccountabilityInvite`/`AccountabilityPartner`/
`AccountabilityOverview` types, `queryKeys.accountability`, `gf-cw-*` CompanionWidget CSS in
`index.css`), BE (`routes/accountability.py`, its `main.py` include, `AccountabilityInvite`/
`AccountabilityPartnership` models + `User` relationships, accountability schemas,
`tests/test_accountability.py`). Alembic migration dropping the `accountability_invites` /
`accountability_partnerships` tables was generated but not yet applied — see the migration
file under `apps/api/alembic/versions/` for the drop; run `alembic upgrade head` to apply.

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
| Focus mode overlay + "Do this now" blocker CTA | HIDDEN (Task 1) — old Dashboard mounted `FocusOverlay` and inline `DoThisNow` nudge; new `DashboardPage.tsx` (prototype transcription) has no slot for either | `src/components/FocusOverlay.tsx` (DoThisNow logic was inline in deleted `Dashboard.tsx` — recover from git history if revived) | Keep FocusOverlay (anti-overwhelm feature, users liked it) — needs a prototype-styled entry point; DoThisNow cut (overlapped with overdue chips on goal cards) |
| Energy modal / low-energy task resize | HIDDEN (Task 1) — old Dashboard opened `EnergyModal` from sessionStorage `energy=low` (set by `EnergyParamCapture`, still mounted in App.tsx); new DashboardPage never opens it | `src/components/EnergyModal.tsx`, `src/components/EnergyParamCapture.tsx`, `src/hooks/useEnergyMutations.ts` | Keep — backend resize endpoint + push deep-link (`?energy=low`) still exist; re-slot after redesign settles |
| WelcomeBackCard (3+ days inactivity nudge) | HIDDEN (Task 1) — was inline in deleted `Dashboard.tsx`; prototype dashboard has no nudge slot | logic only in git history of `src/pages/Dashboard.tsx` (deleted); CSS `.gf-nudge.is-indigo` kept | Cut — low value vs. streak chips already on cards; revive only with a designed slot |
| Rescue-mode ("Easy Mode") card on goal card | HIDDEN (Task 1) — prototype goal-card layout has no rescue slot; `goal.rescue_mode` + `triggerRescue` mutation still wired in `useGoalMutations` | rescue card JSX in git history of `src/components/GoalCard.tsx` (deleted); backend `/goals/{id}/rescue` intact | Keep backend; needs a designed prototype-style slot (likely a nudge above the task list) |
| InstallPrompt (PWA) | UNCHANGED (Task 1) — mounted app-level in `main.tsx`, never part of Dashboard markup; left as-is | `src/components/InstallPrompt.tsx` | Keep |
| OfflineBanner | UNCHANGED (Task 1) — mounted app-level in `App.tsx`; the offline e2e test depends on it; left as-is | `src/components/OfflineBanner.tsx` | Keep |
| RewardModal + badge confetti | KEPT (Task 1) — jackpot drops open `RewardModal`; `completeTask.onSuccess` still invalidates `queryKeys.badges(userId)`; badge-unlock confetti effect ported verbatim into `DashboardPage.tsx` | `src/components/RewardModal.tsx`, `src/components/ConfettiContext.tsx`, `src/pages/DashboardPage.tsx` | Keep |

| Landing stats band metrics | PLACEHOLDER (Task 7) — prototype's illustrative figures kept verbatim incl. "Illustrative figures" note | `src/pages/LandingPage.tsx` stats band | Product decision pre-launch: real metrics or drop the band |
| Landing mobile sign-in path | GAP (Task 7) — burger menu carries only "Let's plan" CTA; desktop-only "Sign in" link hidden ≤760px (prototype had no auth) | `src/pages/LandingPage.tsx` nav + `src/landing.css` | Add "Sign in" item to burger menu when convenient |

Note (Task 0): rows in earlier sections referencing `AppHeader.tsx`/`Layout.tsx` are stale — both files were deleted in the rebuild; ledger gets a full rewrite in Task 9.

## Out of scope (separate later redesign passes)

- **Onboarding** (`src/pages/Onboarding.tsx`) — handoff `app/GoalForge Onboarding.html`.
- **Landing page** (`src/pages/LandingPage.tsx`) — handoff `landing/GoalForge Landing.html` (warm palette).
