# Testing Strategy

## Objectives

- Prevent regressions in goal/task/reward flows.
- Detect security and ownership violations early.
- Keep CI feedback fast enough for branch-per-feature workflow.

## Test Pyramid

1. Unit tests:
- Utility logic (date windows, scoring, small transformers).
- Pure service logic where possible.

2. Integration tests (primary focus today):
- FastAPI route behavior with test DB.
- Ownership enforcement and failure paths.
- AI error fallback behavior via mocks.

3. Frontend tests:
- Hook and component behavior for critical flows.
- At minimum: settings saves, task completion updates, key analytics cards.

4. End-to-end smoke:
- Sign in -> create goal -> complete task -> observe points update.

## Minimum Gates Per PR

Backend changes:

- Relevant pytest file(s) pass.
- No new linter/type errors.

Frontend changes:

- `npm run build` passes.
- `npx tsc --noEmit` passes.

Cross-cutting changes:

- Add or update tests for new endpoint/behavior.

## Ownership Matrix

- Backend route authors own API integration tests.
- Frontend feature authors own hook/component behavior tests.
- Refactor PRs must include at least smoke validation notes.

## Flaky Test Policy

1. Mark flaky tests immediately in PR notes.
2. Open follow-up fix ticket/PR in same day.
3. Do not disable tests silently.

## Test Data Principles

- Prefer deterministic fixtures.
- Avoid environment-dependent assumptions.
- Mock external AI/email/push providers in test scope.
