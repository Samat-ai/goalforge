# GoalForge Architecture

## System Overview

GoalForge is a two-app monorepo:

- `apps/api`: FastAPI async backend (business logic, auth, AI orchestration, persistence).
- `apps/web`: React + TypeScript SPA (goal/task UX, analytics, settings, gamification).

Primary runtime dependencies:

- PostgreSQL for persistent state.
- Gemini 2.5 Flash for structured AI generation.
- Clerk JWT auth for user identity.

## Backend Boundaries

- `routes/`: Request/response handling and validation boundary.
- `services/`: Business workflows, async background behaviors.
- `deps.py`: Ownership and access helpers.
- `ai_utils.py`: Structured AI calls and retry/timeout behavior.
- `models.py` + Alembic: Persistent schema and migrations.

Design rule: keep transport logic in routes and domain logic in services.

## Frontend Boundaries

- `pages/`: Route-level views.
- `components/`: UI building blocks and flows.
- `hooks/`: Data fetching/mutations via React Query.
- `lib/`: Shared types, query keys, gamification helpers.

Design rule: data access via hooks, not directly from page/component internals.

## Critical Flows

### Goal Creation Flow

1. Client posts raw goal input.
2. API persists placeholder goal/milestone and returns 202.
3. Background generation creates milestones/tasks and updates sprint state.
4. Client refreshes goal state via query updates.

### Task Completion Flow

1. Client triggers complete mutation.
2. API locks task row and enforces idempotency.
3. Reward service awards points atomically.
4. Response returns optional reward drop metadata.

### Sprint Progression Flow

1. Client completes active milestone.
2. API validates ownership/state and advances next milestone.
3. Task generation runs for next sprint if needed.

## Data Ownership and Security

- User-scoped route access enforced through auth + ownership helpers.
- All state mutations are scoped by authenticated user identity.
- Sensitive operations (jobs endpoint) require API key auth.

## Reliability Patterns

- SQL-level atomic increments/deductions for point economy.
- Retry and timeout wrappers for AI generation.
- Rate limits on high-cost and mutation-heavy endpoints.
- Structured logging with request IDs for traceability.

## Known Scale Risks

- In-process background tasks are not durable across restarts.
- Full historical task loading can become heavy for very large accounts.

## Future Architecture Targets

- Durable job queue for generation/reminder workloads.
- Redis-backed distributed rate limiting.
- Explicit read models for heavy analytics endpoints.
