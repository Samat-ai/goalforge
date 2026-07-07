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
| Focus mode overlay ("one thing" single-task mode) | `src/components/FocusOverlay.tsx`, `src/lib/pickOneThing.ts` (no importer — entry point was in deleted old Dashboard) | **Keep** — liked anti-overwhelm feature; needs a prototype-styled entry point |
| Energy modal / low-energy task resize | `src/components/EnergyModal.tsx`, `src/components/EnergyParamCapture.tsx` (mounted in `App.tsx`, captures `?energy=low` to sessionStorage; nothing reads it), `src/hooks/useEnergyMutations.ts` (no importer) | **Keep** — backend resize endpoint + push deep-link still exist; re-slot after redesign settles |
| Trophy Room / collection modal | `src/components/CollectionModal.tsx` (no importer — opener lived in deleted `AppHeader`/`Layout`) | **Keep** — collectibles still drop from jackpots; needs a new opener (likely Logs page) |
| Reward modal (jackpot drop) + badge confetti | `src/components/RewardModal.tsx`, `src/components/ConfettiContext.tsx` — **live**, wired in `DashboardPage.tsx` | Keep (active) |
| Equipped reward themes (body class from purchased theme) | `src/hooks/useRewards.ts` (`useRewardsQuery` used by DashboardPage for jackpot equip; theme body-class effect not applied by `AppShell`) | **Cut theme effect** — conflicts with the locked prototype look; keep the hook (jackpot equip uses it) |
| Weekly review data hook | `src/hooks/useWeeklyReview.ts` (exported from `hooks/index.ts`, no consumer; reflection card on Analytics uses `useWeeklyReflection` instead) | **Cut** next sweep unless a review card ships |
| Rescue-mode ("Easy Mode") card | `goal.rescue_mode` + `triggerRescue` in `src/hooks/useGoalMutations.ts` (wired); card JSX only in git history of deleted old `GoalCard.tsx`; backend `/goals/{id}/rescue` intact | **Keep backend**; needs a designed slot on the prototype goal card |
| WelcomeBackCard (3+ days inactivity nudge) | git history of deleted `src/pages/Dashboard.tsx` only; `.gf-nudge.is-indigo` CSS kept | **Cut** — low value vs. streak chips; revive only with a designed slot |
| DoThisNow inline nudge | git history of deleted `src/pages/Dashboard.tsx` only | **Cut** — overlapped with overdue chips on goal cards |
| InstallPrompt (PWA) | `src/components/InstallPrompt.tsx` — live, mounted in `main.tsx` | Keep (active) |
| OfflineBanner | `src/components/OfflineBanner.tsx` — live, mounted in `App.tsx`; offline e2e depends on it | Keep (active) |
| Push notification settings | `src/hooks/usePushNotifications.ts` — live, surfaced on redesigned Settings | Keep (active) |
| Header chrome (equipped-title badge, first-name text, relic-count opener) | not rendered by `src/components/gf/AppShell.tsx`; JSX + CSS (`.gf-title-badge`/`.gf-relic-btn`/`.gf-header-name`) removed in Task 9 — recover from git history if revived | Re-introduce in a post-redesign header pass |

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
- **Chat suggestion chips are static**: `src/pages/ChatPage.tsx` renders fixed
  prototype chips, not AI-generated suggestions.
- ~~**Onboarding has no step persistence**~~ — FIXED (PR #168): wizard progress
  persists to sessionStorage; cleared on skip/finish.

## 4. Pre-existing backend issues — RESOLVED (PR #167)

Backend suite is green (180 passed, 2 skipped): the invalid `goal_type="fitness"`
conftest seed is fixed, and the 8 energy-resize / streak-saver failures were one
time-of-day bug — tests used local `date.today()` while routes compute
`user_today("UTC")`. Tests must use `utc_today()` from `tests/conftest.py`.
