# Ownership Map

## Backend Domain Ownership

- Auth and ownership guards: `auth.py`, `deps.py`.
- Goal/task/milestone flows: `routes/goals.py`, `routes/tasks.py`, `routes/milestones.py`, `services/task_service.py`.
- Reward economy: `routes/rewards.py`, `routes/shop.py`, `services/reward_service.py`.
- User settings and data controls: `routes/users.py`.
- Jobs and reminders: `routes/jobs.py`, `services/email_service.py`.

## Frontend Domain Ownership

- Core dashboard execution loop: `src/pages/Dashboard.tsx`, `src/components/GoalCard.tsx`, `src/hooks/useGoalMutations.ts`.
- Analytics: `src/pages/Analytics.tsx`, analytics hooks.
- Settings and preferences: `src/pages/Settings.tsx`, `src/hooks/useSettings.ts`.
- Rewards/shop/push: related hooks and modal/components.

## Cross-Cutting Ownership

- Type contracts: `apps/web/src/lib/types.ts` and backend `schemas.py`.
- Query key conventions: `apps/web/src/lib/queryKeys.ts`.
- Data model and migrations: `models.py` + Alembic versions.

## Review Expectations

- Changes to cross-cutting files require at least one reviewer familiar with both API and web integration.
- Auth/ownership and migration changes require explicit risk notes in PR body.
