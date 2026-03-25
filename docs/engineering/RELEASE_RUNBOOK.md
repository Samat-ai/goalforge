# Release Runbook

## Release Readiness Checklist

1. Branch hygiene:
- All release-target PRs approved.
- No unresolved review threads.
- No known high severity issues left open.

2. Validation:
- Backend tests pass for changed areas.
- Frontend build/type-check pass.
- Migration plan validated for schema changes.

3. Documentation:
- CLAUDE.md updated for endpoint/behavior changes.
- Release notes drafted.

## Pre-Deploy Steps

1. Confirm production env vars are present.
2. Confirm database backup strategy is healthy.
3. Confirm migrations are reversible or safe-forward.

## Deploy Steps

1. Deploy backend image.
2. Run migrations.
3. Deploy frontend image.
4. Smoke test critical flows:
- Authenticated dashboard load.
- Goal list retrieval.
- Task completion.
- Reminder job endpoint auth guard.

## Post-Deploy Verification

1. Monitor error rate, p95 latency, and logs for 30 minutes.
2. Check structured logs for repeated 5xx patterns.
3. Confirm no migration lock/contention issues.

## Rollback Plan

1. Trigger rollback if critical flow failure or elevated 5xx persists.
2. Roll back app images to previous known-good version.
3. If migration is irreversible, execute documented forward-fix plan.
4. Publish incident update with impact window.

## Communication Template

- What changed.
- User impact.
- Current status.
- Next update time.
