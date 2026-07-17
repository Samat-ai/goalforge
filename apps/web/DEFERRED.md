# Redesign — Deferred & Cut Features (final ledger)

Current-state ledger after the 2026-07 full redesign rebuild (branch
`feature/redesign-full-rebuild`, plan `2026-07-04-full-redesign-rebuild.md`).
All 8 surfaces (shell, Dashboard, Analytics, Logs, Chat, Settings, Onboarding,
Landing) are 1:1 transcriptions of `design_handoff_goalforge/` prototypes.

Spec: `docs/superpowers/specs/2026-07-04-full-redesign-rebuild-design.md`

## 1. Removed (Task 8)

**Accountability partners** and **CompanionWidget** ("tamagotchi bubble") were fully
deleted — FE (`useAccountability.ts` + export, `AccountabilityInvite`/`AccountabilityPartner`/
`AccountabilityOverview` types, `queryKeys.accountability`, `gf-cw-*` CSS), BE
(`routes/accountability.py` + its `main.py` include, `AccountabilityInvite`/
`AccountabilityPartnership` models + `User` relationships, accountability schemas,
`tests/test_accountability.py`), DB (Alembic migration `aed0f1b7b895_drop_accountability_tables.py`
— **applied**; `accountability_invites` / `accountability_partnerships` tables are dropped,
DB is at head `aed0f1b7b895`).

## 2. Hidden features kept in the codebase

These have zero (or partial) render paths in the redesigned UI but their code is kept
by decision. Do not delete in dead-code sweeps.

| Feature | Where code lives | Keep/cut recommendation |
|---|---|---|
| ~~Focus mode overlay ("one thing" single-task mode)~~ | `src/components/FocusOverlay.tsx`, `src/lib/pickOneThing.ts` — **re-slotted 2026-07-07**: `◎ Focus` button in Dashboard list head (renders only when `pickOneThing` finds an actionable task); **organic trigger since PR #220**: `SollySuggestion` banner (conditions in `src/lib/suggestions.ts`) | Keep (active again) |
| ~~Energy modal / low-energy task resize~~ | `src/components/EnergyModal.tsx` + `useEnergyMutations.ts` — **re-slotted 2026-07-07**: `⚡ Low energy` list-head button + sessionStorage deep-link read on Dashboard; restore chips on resized task rows in `GoalCard`; **organic trigger since PR #220**: `SollySuggestion` banner (conditions in `src/lib/suggestions.ts`) | Keep (active again) |
| ~~Trophy Room / collection modal~~ | `src/components/CollectionModal.tsx` — **re-slotted 2026-07-07**: opened via `TrophyStrip` on Logs page; registry counts shared via `src/lib/collectibles.ts` | Keep (active again) |
| Reward modal (jackpot drop) + badge confetti | `src/components/RewardModal.tsx`, `src/components/ConfettiContext.tsx` — **live**, wired in `DashboardPage.tsx` | Keep (active) |
| Equipped reward themes (body class from purchased theme) | `src/hooks/useRewards.ts` (`useRewardsQuery` used by DashboardPage for jackpot equip; theme body-class effect not applied by `AppShell`) | **Cut theme effect** — conflicts with the locked prototype look; keep the hook (jackpot equip uses it) |
| ~~Weekly review data hook~~ | **CUT 2026-07-07**: `useWeeklyReview.ts` + its `hooks/index.ts` export, `queryKeys.weeklyReview`, and `WeeklyReviewResponse` type all removed (zero consumers; Analytics reflection uses `useWeeklyReflection`). Backend `/users/{id}/weekly-review` left intact. | Done — cut |
| ~~Rescue-mode ("Easy Mode") card~~ | `goal.rescue_mode` + `triggerRescue` in `src/hooks/useGoalMutations.ts` — **re-slotted 2026-07-07 (PR #173)**: renders in `GoalCard` Today tab when `goal.rescue_mode` set (not achieved/abandoned), replaces task list with `triggerRescue` CTA + "show my full plan" 8h per-goal localStorage dismissal; error toast on failure; `.gf-rescue-*` CSS restored | Keep (active again) |
| WelcomeBackCard (3+ days inactivity nudge) | git history of deleted `src/pages/Dashboard.tsx` only; `.gf-nudge.is-indigo` CSS kept | **Cut** — low value vs. streak chips; revive only with a designed slot |
| DoThisNow inline nudge | git history of deleted `src/pages/Dashboard.tsx` only | **Cut** — overlapped with overdue chips on goal cards |
| InstallPrompt (PWA) | `src/components/InstallPrompt.tsx` — live, mounted in `main.tsx` | Keep (active) |
| OfflineBanner | `src/components/OfflineBanner.tsx` — live, mounted in `App.tsx`; offline e2e depends on it | Keep (active) |
| Push notification settings | `src/hooks/usePushNotifications.ts` — live, surfaced on redesigned Settings | Keep (active) |
| ~~Header chrome (equipped-title badge, first-name text)~~ | `src/components/gf/AppShell.tsx` — **re-slotted 2026-07-07**: equipped-title badge (gold mono chip, left of stage pill) + first-name greeting (before `UserButton`); `.gf-title-badge`/`.gf-header-name` CSS restored, hidden ≤700px like `.gf-pts`. **Relic-count opener intentionally NOT re-added** — redundant with the shipped `TrophyStrip` on Logs (PR #170). | Keep (active again) |

CSS note: the LEGACY block at the bottom of `src/index.css` now contains only rules
consumed by the kept components above (FocusOverlay, EnergyModal, RewardModal/jackpot,
CollectionModal, InstallPrompt, OfflineBanner, ErrorBoundary) plus a few ported-page
extras. Zero-consumer rule families were deleted in Task 9.

## 3. Product notes

- **Landing stats band**: prototype's illustrative figures kept verbatim (incl.
  "Illustrative figures" note) in `src/pages/LandingPage.tsx`. Pre-launch decision:
  real metrics or drop the band.
- ~~**Landing mobile sign-in gap**~~ — FIXED (PR #168): burger menu now carries
  a "Sign in" m-link for signed-out visitors.
- ~~**Chat suggestion chips are static**~~ — SHIPPED (chat-agent harness PR 1,
  2026-07-11): `ChatPage.tsx` now renders AI-generated chips (up to 4, from
  the latest coach message) plus inline plan cards on `forged_goal_id`, on
  the new coach v2 session pipeline. Does not touch the separate header-chrome
  item (section 2 table — already re-slotted/active, unaffected by this PR).
- ~~**Chat v2 design port — 3 items PR 1's final review deferred**~~ — SHIPPED
  (chat-v2 port PR 2, 2026-07-13): (1) `DELETE /coach/sessions/{id}` now has a
  UI consumer — the session rail's inline trash → 2-step confirm
  (`CoachRail.tsx`); (2) legacy-title fallback (session with `title IS NULL` →
  first user message, else "Intake session") is `fallbackTitle()` in
  `src/lib/coachView.ts`, fed by a new `preview` field on
  `GET /users/{id}/coach/sessions`; (3) plan cards now hydrate the full
  refined `PlanCard` from the goals list query (`queryKeys.goals`, limit 100)
  instead of PR 1's compact fallback — goal not found (deleted) ⇒ no card,
  message text only. Also shipped in the same PR: session rail with time
  buckets, mobile drawer, hero empty state, floating composer, word-reveal
  streaming with stop, per-session error+retry rows, resting-Solly daily-cap
  moment. This PR did NOT touch the header-chrome item (section 2 table) —
  that row is AppShell-wide chrome (equipped-title badge, first-name
  greeting), unrelated to ChatPage's own session header.
- ~~**Onboarding has no step persistence**~~ — FIXED (PR #168): wizard progress
  persists to sessionStorage; cleared on skip/finish.

## 4. Pre-existing backend issues — RESOLVED (PR #167)

Backend suite is green (180 passed, 2 skipped): the invalid `goal_type="fitness"`
conftest seed is fixed, and the 8 energy-resize / streak-saver failures were one
time-of-day bug — tests used local `date.today()` while routes compute
`user_today("UTC")`. Tests must use `utc_today()` from `tests/conftest.py`.
