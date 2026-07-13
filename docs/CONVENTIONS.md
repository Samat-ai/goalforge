# GoalForge Coding Conventions & File Structure

Rules for keeping the codebase modular and redundancy-free. Most rules here exist
because breaking them already caused a real bug or a real cleanup PR — the
incident is noted with each rule. When you add a lesson, add the *why*.

Companion docs: `docs/DEPLOYMENT.md` (ops), `.claude/CLAUDE.md` (AI-assistant
working notes, local-only), `apps/web/DEFERRED.md` (hidden-but-kept UI).

---

## 1. Where new code goes

| You are writing… | It goes in… |
|---|---|
| A new endpoint | `apps/api/routes/<resource>.py` — thin handler only |
| Business logic / anything two routes share | `apps/api/services/<domain>_service.py` |
| A resource loader / ownership check | `apps/api/deps.py` |
| A Gemini call | `apps/api/ai_utils.py`, via `_generate_structured()` |
| A DB model / constraint | `apps/api/models.py` + Alembic migration in the same PR |
| Request/response schemas | `apps/api/schemas.py` |
| A new page | `apps/web/src/pages/<Name>Page.tsx` + nav entry in `gf/AppShell.tsx` |
| Server state (queries/mutations) | `apps/web/src/hooks/use<Thing>.ts` |
| Pure logic, view-model math, shared constants | `apps/web/src/lib/` |
| A reusable component | `apps/web/src/components/` (`gf/` = prototype-port layer) |

**Never**: business logic in route handlers, API calls inside components,
UI-shape math inside components (that's what `lib/goalView.ts` etc. are for).

---

## 2. Backend

### Layering
- **Routes are thin**: parse → authorize → call service/helper → serialize.
  If a handler grows past ~40 lines of logic, extract a service function.
  *(Incident: `users.py` export/badges and `jobs.py` trigger_reminders grew into
  150+ line route bodies before this rule existed.)*
- **Cross-route imports are forbidden.** Shared code moves to `deps.py` or
  `services/`. Never `from routes.X import Y`, and never re-define a deps helper
  locally. *(Incident: a stale local copy of `get_or_create_user` in
  `routes/goals.py` drifted from `deps.py` and silently dropped the
  placeholder-email upgrade — fixed in PR #192.)*

### deps.py — the single home for loaders
- Ownership: `_ensure_owner(resource_owner_id, current_user_id)` — always this,
  never inline `if user_id != current_user_id`.
- Loaders: `_load_user_with_ownership`, `_load_goal_with_ownership(full=,
  for_update=)`, `_load_task_with_ownership`, `_load_reward_with_ownership`,
  `_load_shop_reward_with_ownership`, `load_full_goal`.
- Returning a `GoalResponse`? You need `full=True` / `load_full_goal()` —
  async sessions cannot lazy-load and serialization will raise `MissingGreenlet`.
- New resource type ⇒ add its loader **to deps.py**, not to the route module.

### DB sessions & transactions
- Request handlers: use the injected `get_db()` session; it commits/rolls back
  for you. Don't call `db.flush()` unless you need generated PKs mid-request.
- **Background coroutines** (`asyncio.create_task` / `BackgroundTasks`):
  1. Open your own `AsyncSession(engine)` — the request session is closed.
  2. **Plain `execute` + `commit()` only — never `async with db.begin()` after
     the session has run any query.** SQLAlchemy autobegins a transaction on
     first use; an explicit `begin()` then raises `InvalidRequestError`.
     *(Incident: this exact mix silently disabled Magic Pre-Gen for weeks —
     PR #190. The error was swallowed by a broad `except`.)*
  3. Commit (or roll back) before any network call — never hold a DB
     connection across a Gemini/HTTP round-trip.
  4. In `except` blocks, `await db.rollback()` before writing failure status.
  5. Attach `_log_task_exception` done-callback before the discard callback;
     keep a strong ref in a module-level `set[asyncio.Task]`.
- Money paths (star points): atomic SQL only —
  `UPDATE … SET x = x + N` (+ `WHERE x >= cost` guard for spends). Never
  read-modify-write. State transitions on milestones/tasks: `with_for_update()`.

### Notifications — checklist for ANY new outbound message
Every branch in `trigger_reminders` (and any future sender) must have all four:
1. **Consent gate** — respects `user.reminder_enabled` (it's checked at the top
   of the loop; don't add a branch above it).
2. **Dedup** — `NotificationLog` row + `_already_notified()` check. New type ⇒
   extend `ck_notification_log_type` in models **and** a migration.
3. **Cadence gate** — the cron fires **hourly**; without an hour match
   (`now_local.hour == user.reminder_hour` or an explicit window) the user gets
   your message up to 24×/day. *(Incident: rescue emails spammed hourly with no
   consent/dedup/hour gate — PR #191.)*
4. **User-local time** — `user_today(user.timezone)` / `user_now(...)`, never
   `date.today()`.

### AI calls
- All Gemini calls go through `ai_utils._generate_structured()` (which wraps
  `_with_retry`, timeout, JSON parse, schema validation). A new AI feature =
  a prompt constant + a thin public function. Never call
  `_client.aio.models.generate_content` directly.
- `temperature=1.0`, `response_mime_type="application/json"`,
  `response_schema=<Pydantic model>` — set inside the helper; don't override.
- **Any new surface that feeds user text into a Gemini call needs an explicit
  guard decision**: active guard (`classify_user_input`) for conversational/
  creation inputs, `_HARDENING_RULES` for embedded stored text. *(Motivated by
  the chat-agent harness — PR 1, 2026-07-11.)*
- **Never `Optional[list[Model]]` in a response schema.** google-genai converts
  `list[X] | None` to `{"nullable": true, "type": "ARRAY"}` — the `items`
  definition is dropped and Gemini rejects every request with
  `400 INVALID_ARGUMENT (…items: missing field)`. Use
  `list[X] = Field(default_factory=list)`; treat empty as absent. Scalar
  `str | None` fields are fine. *(Incident: `AICoachTurnV2.edits` broke all
  coach replies post-merge — fixed in PR #196.)*

### API surface policy
- **No endpoint without a consumer.** Ship the frontend caller (or cron/job
  usage) in the same PR, or don't ship the endpoint.
- An endpoint that contradicts a product rule is a bug even if unused.
  *(Incident: `PATCH /goals/{id}/progress` violated the no-manual-progress
  anti-cheat rule and had zero callers — removed in PR #192.)*
- Removing an endpoint: delete its schema classes and tests in the same commit;
  update `.claude/REFERENCE.md`.

### Misc backend
- Rate-limited routes: `request: Request` first param; import `rate_limit` +
  `_user_key` from `rate_limiting.py`.
- `HTTPBearer(auto_error=False)` + explicit 401 (default raises 403).
- Strict `Literal` response fields need a `field_validator(mode='before')`
  normalizer or legacy rows 500 on read.
- Response schemas for clients and `AI*` schemas both live in `schemas.py`;
  keep the AI block at the bottom under its divider.

---

## 3. Frontend

### Folder taxonomy
- `pages/` — route targets only; register routes in `App.tsx`, nav in
  `gf/AppShell.tsx`.
- `hooks/` — all server state. One hook per concern; components never call
  `api.*` directly (only hooks and page-level one-offs like the Settings export
  blob do).
- `lib/` — pure functions and shared constants. **View-model math lives here**
  (`goalView.ts`, `analyticsView.ts`), not in components. New shared constants
  go in `lib/` (component files may export only components —
  `react-refresh/only-export-components`).
- `components/` — shared components; `components/gf/` is the prototype-port
  layer (1:1 rule applies — see `.claude/CLAUDE.md`); check
  `apps/web/DEFERRED.md` before deleting "unused" code.

### React Query
- Keys only from `lib/queryKeys.ts`. Never inline key arrays.
- **Dashboard's `useGoalMutations` is the authoritative goals-cache owner.**
  Overlays/modals receive mutations as props; they must not instantiate it.
- Optimistic updates: snapshot in `onMutate`, roll back in `onError`. If the
  server may award/deny something the optimistic update assumed (points!),
  reconcile in `onSuccess`/`onSettled` with the response or an invalidation.
  *(Incident: re-achieving a goal kept a phantom optimistic +100 — PR #192.)*

### Dates & purity
- `todayStr()` / `daysAgo()` from `lib/gamification.ts` for all YYYY-MM-DD math
  (DST-safe noon anchor). No `new Date()` / `Date.now()` in render bodies
  (ESLint-enforced) — compute in effects or lazy state initializers.
- SVG gradient/filter ids: `useId()`, never `Math.random()`.

### Overlays & fixed position
- **Any `position: fixed` overlay (drawer, modal, scrim) must `createPortal`
  to `document.body`** (or `.gf-root` — see `SettingsPage`'s confirm modal),
  never render inline in the page tree. `PageSwitcher`'s `.gf-xfade` wrapper
  sets `will-change: transform` unconditionally on every page, which makes it
  a CSS containing block for `position: fixed` descendants — an unportaled
  fixed element pins to that wrapper's box instead of the viewport. A
  portaled subtree also falls outside `.gf-root`'s font/color/`:focus-visible`
  inheritance — restate those rules for it. *(Incident: `ChatPage`'s mobile
  `CoachDrawer` had to portal for exactly this reason — chat-v2 port PR 2;
  `SettingsPage`'s delete-confirm modal already portaled for the same
  underlying reason without it ever being written down.)*

---

## 4. Testing

- **TDD for bug fixes**: write the failing test first, watch it fail, then fix.
  A bug without a regression test will come back.
- Backend tests use `utc_today()` from `tests/conftest.py`, never
  `date.today()` (evening flakes in UTC+ timezones otherwise).
- **The global-mock rule**: anything `conftest.py` patches wholesale
  (`_pre_generate_sprint`, `_generate_goal_async`, email/push senders) must
  have at least one dedicated test that exercises the REAL implementation with
  only its external I/O mocked. *(Incident: pre-gen was 100% broken in prod
  while 187 tests passed, because the whole coroutine was an `AsyncMock` —
  PR #190.)*
- Frontend: pure logic in `src/lib/` is covered by Vitest
  (`npm run test`, `src/lib/__tests__/`). New `lib/` module ⇒ new test file.
  Use `vi.setSystemTime` for date-dependent functions.
- E2E: Playwright (`npm run test:e2e`); don't start the dev server manually.

---

## 5. Git & CI

- Branch always (`feature/` `fix/` `refactor/` `chore/`); Conventional Commits;
  squash-merge via `gh pr merge <n> --squash --delete-branch`.
- Merge order: fix → local verify → user tests → CI green → merge.
- CI gates (all must pass): backend pytest, `eslint` (0 errors),
  `tsc -b --noEmit` (plain `tsc --noEmit` checks **zero files** — the root
  tsconfig is solution-style), Vitest, `vite build`.
- New migration ⇒ note `docker compose exec api alembic upgrade head` in the
  PR body; container must be rebuilt first if the image predates the file.
- Never commit `.env`; never `git add -f` anything gitignored
  (`.claude/`, `design_handoff_goalforge/`).
