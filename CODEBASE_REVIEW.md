# GoalForge — Codebase & Project State Review

**Date:** 2026-03-14  
**Branch reviewed:** `main` (commit `a7d3087` — latest merged state)  
**Reviewer scope:** Full-stack codebase audit — architecture, code quality, security, testing, frontend, AI integration, gamification, CI/CD, and actionable recommendations.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Repository Structure](#2-repository-structure)
3. [Backend Architecture (FastAPI)](#3-backend-architecture-fastapi)
4. [Frontend Architecture (React + TypeScript)](#4-frontend-architecture-react--typescript)
5. [AI Integration (Gemini 2.5 Flash)](#5-ai-integration-gemini-25-flash)
6. [Database Design](#6-database-design)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Gamification System](#8-gamification-system)
9. [Testing & CI/CD](#9-testing--cicd)
10. [Security Analysis](#10-security-analysis)
11. [Code Quality & Conventions](#11-code-quality--conventions)
12. [UX/UI Review](#12-uxui-review)
13. [Performance Considerations](#13-performance-considerations)
14. [Gaps & Missing Features](#14-gaps--missing-features)
15. [Priority Recommendations](#15-priority-recommendations)
16. [Final Verdict](#16-final-verdict)

---

## 1) Executive Summary

GoalForge is an **AI-powered goal-tracking application** with RPG-style gamification. It transforms plain-language goals into structured SMART plans with 7-day sprint milestones, daily tasks, and a star-point evolution system.

**Current state:** Feature-complete MVP with a clean monorepo structure. All 23 backend tests pass, frontend lints and builds cleanly. The codebase is well-organized, uses modern frameworks, and follows reasonable conventions.

**Key strengths:**
- Solid async FastAPI backend with SQLAlchemy 2.0 mapped columns
- Clean React 19 + TypeScript 5.9 frontend with Tailwind CSS 4
- Thoughtful AI integration with retry logic and structured output
- Gamification with 6 evolution stages and animated SVG companion
- Automated CI pipeline (tests, lint, type-check, build)
- JWT authentication via Clerk with JWKS caching

**Key areas for improvement:**
- No database migration CI validation
- Missing input sanitization on some text fields
- No API pagination on goal/task listing endpoints
- No integration or E2E tests for the frontend
- Limited error recovery UX for users after setbacks

---

## 2) Repository Structure

```
goalforge/
├── .github/workflows/
│   ├── ci.yml                 # Backend tests + Frontend lint/build
│   ├── claude.yml             # Claude Code interactive workflow
│   └── claude-code-review.yml # Automated PR code review
├── apps/
│   ├── api/                   # FastAPI backend (Python 3.12/3.13)
│   │   ├── main.py            # All route handlers (~692 lines)
│   │   ├── models.py          # SQLAlchemy ORM (User, Goal, Milestone, DailyTask)
│   │   ├── schemas.py         # Pydantic request/response schemas
│   │   ├── auth.py            # Clerk JWT/JWKS authentication
│   │   ├── config.py          # Environment settings (pydantic-settings)
│   │   ├── ai_utils.py        # Gemini SDK integration + retry logic
│   │   ├── database.py        # Async engine + session factory
│   │   ├── exceptions.py      # Custom AIGenerationError
│   │   ├── requirements.txt   # Pinned Python dependencies
│   │   ├── alembic/           # Database migrations
│   │   └── tests/             # pytest-asyncio test suite (23 tests)
│   └── web/                   # React frontend (TypeScript)
│       ├── src/
│       │   ├── App.tsx         # Router + AuthGuard
│       │   ├── pages/          # Landing, Dashboard, Analytics, SignIn, SignUp
│       │   ├── components/     # AppHeader, GamificationSvgs
│       │   └── lib/            # api.ts, gamification.ts, theme.ts
│       ├── package.json        # npm deps (React 19, Clerk, Tailwind, Vite)
│       └── eslint.config.js    # ESLint rules
├── README.md                   # Project documentation
├── USER_FEEDBACK_REPORT.md     # Previous user evaluation report
├── USER_FEEDBACK_REPORT.pdf    # PDF export of above
└── LICENSE                     # MIT License
```

**Total codebase:** ~1,400 lines of application code (Python + TypeScript), plus ~190 lines of test code.

**Observation:** The monorepo layout (`apps/api`, `apps/web`) is clean and conventional. No build tool like Turborepo is used, but at this scale it's not needed.

---

## 3) Backend Architecture (FastAPI)

### 3.1 API Endpoints

| Method  | Path                                        | Purpose                         | Rate Limit  |
|---------|---------------------------------------------|---------------------------------|-------------|
| GET     | `/health`                                   | Health check                    | —           |
| GET     | `/users/{user_id}/profile`                  | User star points                | —           |
| POST    | `/users/{user_id}/goals`                    | Create SMART goal (AI-powered)  | 5/minute    |
| GET     | `/users/{user_id}/goals`                    | List all goals                  | —           |
| GET     | `/goals/{goal_id}`                          | Get single goal                 | —           |
| PATCH   | `/goals/{goal_id}`                          | Update goal status              | —           |
| PATCH   | `/goals/{goal_id}/progress`                 | Update progress percentage      | —           |
| DELETE  | `/goals/{goal_id}`                          | Delete goal + cascade           | —           |
| GET     | `/goals/{goal_id}/tasks`                    | List tasks (optional date filter)| —          |
| PATCH   | `/tasks/{task_id}/complete`                 | Complete task + award points    | —           |
| PATCH   | `/tasks/{task_id}`                          | Edit task description           | —           |
| DELETE  | `/tasks/{task_id}`                          | Delete pending task             | —           |
| POST    | `/goals/{goal_id}/milestones/{mid}/complete`| Complete sprint, unlock next    | 10/minute   |

### 3.2 Design Patterns

- **Dependency injection** via FastAPI's `Depends()` for DB sessions and auth
- **Atomic SQL increments** for star points (`User.star_points + 10`) to avoid race conditions
- **Background pre-generation** of next sprint tasks via `asyncio.create_task()` when the last task in a sprint is completed ("Magic Pre-Gen")
- **Milestone lifecycle state machine:** `pending → generating → ready → active → completed | failed`
- **Auto-create user** on first goal creation using Clerk JWT claims

### 3.3 Strengths

- Clean separation of concerns: `models.py`, `schemas.py`, `auth.py`, `ai_utils.py`
- All DB operations are async (SQLAlchemy 2.0 + asyncpg)
- Session management with proper commit/rollback in `get_db()`
- Rate limiting via SlowAPI with user-key and IP-based fallback
- Environment-aware CORS configuration

### 3.4 Issues Found

1. **`main.py` is monolithic** (~692 lines). All route handlers live in one file. As the app grows, this should be split into FastAPI routers (e.g., `routers/goals.py`, `routers/tasks.py`, `routers/milestones.py`).

2. **No pagination** on `list_goals` and `list_tasks` endpoints. For users with many goals/tasks, this will cause performance issues. Add `limit`/`offset` or cursor-based pagination.

3. **Deprecated `@app.on_event("startup")`** (line 94). FastAPI recommends the `lifespan` context manager instead. Tests already show a deprecation warning for this.

4. **Background task error handling** in `_pre_generate_sprint` is fire-and-forget via `asyncio.create_task()`. If the task fails silently, the milestone remains in a stale state. Consider adding structured logging or a task queue (e.g., Celery, arq) for reliability.

5. **`complete_milestone` catches `ValueError`** (line 657) instead of `AIGenerationError` for the synchronous sprint generation fallback. This mismatch could cause unhandled exceptions.

6. **Missing `__all__` exports** in modules — minor, but aids clarity.

---

## 4) Frontend Architecture (React + TypeScript)

### 4.1 Page Structure

| Page         | Path          | Description                                      |
|--------------|---------------|--------------------------------------------------|
| LandingPage  | `/`           | Marketing page with hero, features, CTA          |
| SignInPage   | `/sign-in/*`  | Clerk Sign-In component                          |
| SignUpPage   | `/sign-up/*`  | Clerk Sign-Up component                          |
| Dashboard    | `/dashboard`  | Goal management: create, view, complete tasks    |
| Analytics    | `/analytics`  | Star companion, evolution stages, stats, Hall of Fame |

### 4.2 Design Patterns

- **AuthGuard** component using Clerk's `<Show when="signed-in">` for route protection
- **Centralized design tokens** in `lib/theme.ts` (`T.bg`, `T.orange`, etc.)
- **Gamification logic** isolated in `lib/gamification.ts` (stages, streaks, brightness)
- **Axios client** with `setAuthToken()` for Clerk JWT attachment
- **Toast notifications** via Sonner library
- **Animated SVG companion** creature that evolves through 6 visual stages

### 4.3 Strengths

- Modern stack: React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4
- Clean design token system for consistent theming
- Gamification calculations are pure functions (testable)
- Good use of `useEffect` cleanup patterns with `ignore` flags
- Accessible: `aria-label` on interactive elements, keyboard focus styles

### 4.4 Issues Found

1. **Dashboard.tsx is very large** (~40.5 KB). This single file contains all goal card rendering, task management, milestone interactions, modals, and state. It should be decomposed into smaller components (e.g., `GoalCard`, `TaskItem`, `CreateGoalModal`, `SprintRail`).

2. **No frontend tests.** There are no unit tests for the React components or the gamification utility functions. The `gamification.ts` functions (`streak()`, `starBrightness()`, `stagePct()`) are pure and highly testable.

3. **Inline styles dominate** instead of Tailwind utility classes. The codebase mixes `style={{...}}` objects with Tailwind `className` strings. This inconsistency makes maintenance harder. Should standardize on one approach (preferably Tailwind).

4. **Stage definitions are duplicated** between `gamification.ts` (lines 2-9) and `GamificationSvgs.tsx` (lines 17-24). The SVG component re-defines `STAGE_DEFS` inline "to avoid importing getStage here creating a cycle." This should be resolved by extracting shared constants to a separate module.

5. **Error state handling is minimal.** API failures show a simple error string. No retry buttons, no offline indicators, no loading skeletons.

6. **No loading skeletons.** Current loading state is just a spinner. Skeleton screens would improve perceived performance.

---

## 5) AI Integration (Gemini 2.5 Flash)

### 5.1 How It Works

- **Goal creation:** User's raw text → Gemini API → `AIGoalOutput` Pydantic schema (SMART title, description, 3-5 milestones, 7 daily tasks for sprint 1)
- **Sprint generation:** When a sprint completes → Gemini API → `AISprintOutput` (7 daily tasks for the next sprint)
- **Structured output:** Uses `response_mime_type="application/json"` + `response_schema=<PydanticModel>` to constrain Gemini's output to valid JSON matching the schema

### 5.2 Retry Logic

```
Attempt 1 → failure → wait 1s → Attempt 2 → failure → wait 2s → Attempt 3 → AIGenerationError
```

Retries on: `APIError`, `JSONDecodeError`, `ValidationError`. This is a solid retry strategy.

### 5.3 Strengths

- **Structured output enforcement** via Pydantic schemas passed to Gemini — ensures type safety
- **Robust retry logic** with exponential backoff (1s, 2s delays)
- **Background pre-generation** ("Magic Pre-Gen") for near-instant sprint transitions
- **Custom `AIGenerationError`** exception for clean error propagation
- **Temperature 1.0** for thinking-mode Gemini 2.5 Flash (as recommended by Google)

### 5.4 Issues Found

1. **No cost/token tracking.** Gemini API usage is not metered or logged. For production, add logging of token usage and costs.

2. **No prompt versioning.** System prompts are hardcoded strings. Changes to prompts aren't tracked or A/B tested. Consider moving prompts to configuration or a versioned prompt registry.

3. **No output validation beyond schema.** The AI could generate unrealistic dates or tasks that don't match the sprint theme. Consider adding semantic validation (e.g., target_date must be > today + 7 days).

4. **`_client` is initialized at module load** (line 27 of `ai_utils.py`). If `GEMINI_API_KEY` is empty, the client is still created — this could cause confusing errors later. Add a startup check.

---

## 6) Database Design

### 6.1 Entity Relationship

```
User (1) ──→ (N) Goal (1) ──→ (N) Milestone
                   │                    │
                   └──→ (N) DailyTask ←─┘ (optional FK)
```

### 6.2 Models

| Model     | Key Fields                                                                 |
|-----------|---------------------------------------------------------------------------|
| User      | `id` (Clerk user_id, PK), `email` (unique), `star_points`                |
| Goal      | `id` (UUID), `user_id` (FK), `raw_input`, `smart_title`, `smart_description`, `goal_type`, `target_date`, `status`, `current_streak`, `best_streak`, `vitality`, `progress` |
| Milestone | `id` (UUID), `goal_id` (FK), `title`, `position`, `is_final`, `sprint_theme`, `sprint_status`, `is_completed` |
| DailyTask | `id` (UUID), `goal_id` (FK), `milestone_id` (nullable FK), `description`, `tip`, `assigned_date`, `is_completed` |

### 6.3 Strengths

- Proper cascade deletes (`ondelete="CASCADE"`) on foreign keys
- Mapped columns with explicit types and constraints
- `selectinload` used correctly to avoid N+1 queries
- Indexes on all foreign key columns

### 6.4 Issues Found

1. **`current_streak` and `best_streak` on Goal** are model fields but are never updated by backend logic. The frontend calculates streaks independently of `completed_days`. These fields appear to be dead code.

2. **`vitality` field on Goal** (default 50) is never read or updated anywhere in the codebase. This is dead code.

3. **No database indexes** on `DailyTask.assigned_date` despite it being used in query filters (`WHERE assigned_date = ?`). Add an index for performance.

4. **No `updated_at` timestamps** on any model. This makes it hard to track when records were last modified.

5. **Alembic migrations exist** but are not validated in CI. Consider adding `alembic check` or `alembic upgrade head` to the test pipeline.

---

## 7) Authentication & Authorization

### 7.1 Implementation

- **Clerk JWT** tokens verified via JWKS endpoint
- **JWKS caching** with TTL (10 minutes) and async lock for thread safety
- **Key rotation handling:** if `kid` not found in cache, evict and retry once
- **Two auth dependencies:** `get_current_user_id` (sub claim) and `get_current_user_email` (email claim with fallback)

### 7.2 Strengths

- Double-check pattern after acquiring `_jwks_lock` prevents redundant fetches
- Audience verification intentionally disabled (Clerk tokens don't have fixed audience)
- Email fallback to `{sub}@placeholder.goalforge.app` prevents `UNIQUE` constraint violations

### 7.3 Issues Found

1. **Every protected endpoint repeats the same ownership check** pattern:
   ```python
   if goal.user_id != current_user_id:
       raise HTTPException(status_code=403, detail="Access denied")
   ```
   This should be extracted into a reusable dependency or decorator.

2. **No role-based access control.** Currently all users have identical permissions. If admin features are planned, RBAC infrastructure should be added.

3. **`verify_aud: False`** is documented as intentional, but no issuer (`iss`) verification is configured. For production, consider verifying the `iss` claim matches your Clerk instance URL.

---

## 8) Gamification System

### 8.1 Evolution Stages

| Stage     | Points Required | Visual Description                     |
|-----------|-----------------|----------------------------------------|
| Speck     | 0               | Tiny 5-point star, no eyes, dim        |
| Ember     | 30              | Eyes appear, warm orange tones          |
| Flare     | 80              | Mouth appears, 6-point star, orbiting particles |
| Luminary  | 175             | Enhanced glow, rays, 4 orbital particles|
| Nova      | 350             | 8-point star, crown, pupils, 5 orbitals |
| Celestial | 600             | Maximum glow, cross sparkles, full crown|

### 8.2 Point Economy

- **+10 points** per completed daily task
- **+100 points** per achieved goal
- Total to reach Celestial: 600 points = ~60 tasks or ~6 goals achieved

### 8.3 Strengths

- Evolution stages create a compelling long-term progression arc
- Animated SVG creature with pulse, float, and orbit effects is engaging
- Star brightness tied to streak length (7-day cycle matches sprint length)
- Pure functions make gamification logic easy to test

### 8.4 Issues Found

1. **Points are only additive.** There's no mechanism to lose points or have them decay. This means eventually all users converge on Celestial with no further engagement loop.

2. **No social/competitive elements.** Leaderboards, challenges, or accountability partners would strengthen retention.

3. **Star brightness resets on streak break** but there's no UI messaging explaining why the star dimmed. This could confuse users.

---

## 9) Testing & CI/CD

### 9.1 Backend Tests (23 tests, all passing)

| File                   | Tests | Coverage Area                          |
|------------------------|-------|----------------------------------------|
| `test_health.py`       | 1     | Health endpoint                        |
| `test_goals.py`        | 8     | CRUD, status updates, ownership checks |
| `test_tasks.py`        | 6     | Complete, edit, delete tasks           |
| `test_milestones.py`   | 5     | Sprint completion, task generation     |
| `test_ai_errors.py`    | 3     | AIGenerationError handling             |

**Test infrastructure:**
- SQLite in-memory database via `aiosqlite`
- All Gemini calls mocked with `unittest.mock.AsyncMock`
- Two test users (`TEST_USER_ID`, `OTHER_USER_ID`) for ownership tests
- `conftest.py` provides reusable `client`, `other_client`, and `create_test_goal` fixtures

### 9.2 CI Pipeline (`ci.yml`)

| Job              | Runtime     | Steps                                  |
|------------------|-------------|----------------------------------------|
| backend-checks   | Python 3.12 | Install deps → pytest                  |
| frontend-checks  | Node 20     | Install → lint → type-check → build    |

### 9.3 Strengths

- Tests use realistic test data (mock SMART goal with milestones and tasks)
- Ownership tests verify user A can't access user B's data
- CI uses dummy environment variables to avoid real API calls
- Rate limiting disabled in tests to prevent flaky failures

### 9.4 Issues Found

1. **No frontend tests at all.** Gamification utilities (`streak()`, `starBrightness()`, `stagePct()`) are pure functions that should have unit tests. Dashboard interactions should have integration tests.

2. **No E2E tests.** No Playwright or Cypress tests to validate the full user flow.

3. **No code coverage reporting.** Consider adding `pytest-cov` and a coverage threshold.

4. **CI doesn't run Alembic migrations** — the test database uses `create_all()` directly, which doesn't validate migration scripts.

5. **No security scanning** (e.g., `pip audit`, `npm audit`, Snyk, or Dependabot) in CI.

---

## 10) Security Analysis

### 10.1 Positive Findings

- ✅ JWT authentication on all data-access endpoints
- ✅ Ownership checks prevent cross-user data access
- ✅ Rate limiting on AI-intensive endpoints (5/min for goal creation)
- ✅ CORS restricted to configured origins
- ✅ Credentials in `allow_credentials` only enabled in production
- ✅ Cascade deletes prevent orphaned records
- ✅ Atomic SQL increments for star points prevent race conditions
- ✅ No secrets in source code (uses `.env` files)

### 10.2 Concerns

1. **No input sanitization** on `raw_input` (up to 2,000 chars sent to Gemini). Malicious prompts could potentially manipulate AI output. Consider basic filtering.

2. **No CSRF protection.** While JWT-based APIs are less vulnerable to CSRF, consider adding `SameSite` cookie attributes if session cookies are ever used.

3. **No request body size limits** beyond Pydantic field constraints. FastAPI doesn't set a default max body size.

4. **`allow_methods=["*"]` and `allow_headers=["*"]`** in CORS is overly permissive. Restrict to actual methods and headers used.

5. **No `Content-Security-Policy` or other security headers** served by the API.

6. **`httpx.AsyncClient()` created per JWKS fetch** (line 42 of `auth.py`). This is fine at low volume but could be optimized with a shared client.

---

## 11) Code Quality & Conventions

### 11.1 Backend (Python)

- **Style:** Clean, consistent, follows PEP 8
- **Type hints:** Used throughout (Mapped columns, Pydantic schemas, function signatures)
- **Documentation:** Module-level docstrings, inline comments for complex logic
- **Dependency management:** Pinned versions in `requirements.txt`
- **Logging:** Uses Python `logging` module consistently

### 11.2 Frontend (TypeScript)

- **Style:** Functional components, hooks-based state management
- **ESLint:** Configured and passing with no warnings
- **Type safety:** TypeScript strict mode, explicit interfaces for API responses
- **Design tokens:** Centralized in `theme.ts` — good practice

### 11.3 General

- **Git history:** Clean conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `test:`, `refactor:`)
- **PR workflow:** Automated Claude code review on all PRs
- **License:** MIT — permissive, appropriate for open source

---

## 12) UX/UI Review

### 12.1 Strengths

- Dark-theme design is visually cohesive and modern
- Landing page clearly communicates value proposition (3-step flow, features section)
- Analytics page with animated creature provides emotional engagement
- 18-week heatmap for task completion history
- Toast notifications for user feedback
- Responsive design with mobile considerations

### 12.2 Issues

1. **Dense goal cards** can feel overwhelming on first use (noted in previous user feedback report)
2. **No onboarding tour** for new users — the EmptyState component was added but a guided walkthrough is missing
3. **No dark/light mode toggle** — currently dark-only
4. **No loading skeletons** — just a spinner during data fetches
5. **Inline styles** make it hard to ensure consistent hover/focus states across the app

---

## 13) Performance Considerations

### 13.1 Current Positives

- Async database operations (no blocking I/O)
- `pool_pre_ping=True` for connection health checks
- Background pre-generation of sprint tasks reduces user-facing latency
- `selectinload` prevents N+1 queries on goal listing
- Frontend uses Vite for fast builds (3.3s production build)

### 13.2 Concerns

1. **No pagination** on list endpoints — `list_goals` and `list_tasks` fetch ALL records
2. **No database connection pooling configuration** beyond defaults
3. **No caching layer** (e.g., Redis) for frequently accessed data like user profiles
4. **Frontend bundle is 324 KB** (gzipped will be smaller) — reasonable but monitor as features grow
5. **SVG creature animation** runs at 80ms intervals (`setInterval`) — 12.5 FPS. Consider `requestAnimationFrame` for smoother animation without unnecessary re-renders

---

## 14) Gaps & Missing Features

### 14.1 Functional Gaps

| Gap                        | Impact   | Effort  | Priority |
|----------------------------|----------|---------|----------|
| Push notifications/reminders | High   | Medium  | P1       |
| Recovery mode after missed days | High | Medium  | P1       |
| Pagination on list APIs    | Medium   | Low     | P1       |
| Weekly review/reflection   | Medium   | Medium  | P2       |
| Personalization controls   | Medium   | Medium  | P2       |
| Star point redemption      | Low      | Medium  | P3       |
| Social/accountability      | Low      | High    | P3       |

### 14.2 Technical Gaps

| Gap                        | Impact   | Effort  | Priority |
|----------------------------|----------|---------|----------|
| Frontend unit tests        | High     | Low     | P1       |
| E2E test suite             | High     | Medium  | P2       |
| Code coverage reporting    | Medium   | Low     | P1       |
| Database migration CI      | Medium   | Low     | P1       |
| API documentation (OpenAPI)| Low      | Low     | P2       |
| Logging/monitoring setup   | Medium   | Medium  | P2       |
| Error tracking (Sentry)    | Medium   | Low     | P2       |

---

## 15) Priority Recommendations

### P1 — Do Now (immediate quality & reliability)

1. **Add pagination** to `GET /users/{user_id}/goals` and `GET /goals/{goal_id}/tasks` endpoints. Use `limit`/`offset` query params with sensible defaults (e.g., 20 items per page).

2. **Add frontend unit tests** for `gamification.ts` functions and key component logic. Use Vitest (already compatible with Vite).

3. **Remove dead model fields** (`current_streak`, `best_streak`, `vitality` on Goal) or implement backend logic to update them. Dead code creates confusion.

4. **Add `assigned_date` index** on `DailyTask` model for query performance.

5. **Replace deprecated `@app.on_event("startup")`** with FastAPI's `lifespan` context manager.

6. **Fix exception type mismatch** in `complete_milestone`: catch `AIGenerationError` instead of `ValueError` on line 657.

### P2 — Do Soon (product quality & maintainability)

7. **Split `main.py`** into FastAPI routers: `routers/goals.py`, `routers/tasks.py`, `routers/milestones.py`, `routers/users.py`.

8. **Decompose `Dashboard.tsx`** into smaller components: `GoalCard`, `TaskItem`, `CreateGoalModal`, `SprintRail`, etc.

9. **Standardize styling** — choose either inline styles or Tailwind classes and migrate to a consistent approach.

10. **Add push notifications/reminders** — this is the #1 user-facing gap for retention.

11. **Add recovery mode** — auto-detect missed days and offer a lighter re-entry plan.

12. **Extract shared constants** to deduplicate stage definitions between `gamification.ts` and `GamificationSvgs.tsx`.

### P3 — Do Later (growth & scale)

13. **Add E2E tests** with Playwright for critical user flows (sign up → create goal → complete task → view analytics).

14. **Implement reward redemption** — let users convert star points into custom rewards.

15. **Add social features** — optional accountability partners or goal sharing.

16. **Set up monitoring** — Sentry for error tracking, structured logging for observability.

---

## 16) Final Verdict

GoalForge is a **well-built MVP** that demonstrates strong engineering fundamentals:

- **Architecture:** Clean separation of concerns, modern async stack, proper auth
- **AI Integration:** Thoughtful use of Gemini with retry logic and structured output
- **Gamification:** Engaging evolution system with animated SVG companion
- **Code Quality:** Consistent conventions, type safety, automated CI

The codebase is in a healthy state for an early-stage product. The most impactful next steps are:

1. **Reliability:** Add pagination, fix the exception mismatch, clean up dead fields
2. **Testing:** Add frontend unit tests and code coverage
3. **User Retention:** Implement notifications, recovery mode, and weekly reviews
4. **Maintainability:** Split monolithic files (`main.py`, `Dashboard.tsx`) into smaller modules

**Overall Health Score: 7.5/10** — Solid foundation with clear paths for improvement.

---

*This review was conducted on 2026-03-14 against the latest state of the `main` branch, including all merged PRs up to commit `a7d3087`.*
