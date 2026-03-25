# ADR-0001: Adopt Engineering Operating Handbook and ADR Process

- Status: Accepted
- Date: 2026-03-25
- Owners: GoalForge maintainers
- Related PRs: feature/engineering-operating-handbook (pending PR)

## Context

GoalForge has moved quickly on product features but lacked a formal operating layer used by high-performing teams (architecture source-of-truth, release/incident/security runbooks, ownership map, and ADR governance). This increases onboarding and regression risk as feature volume grows.

## Decision

Adopt a repository-level engineering handbook under `docs/engineering/` and require ADRs for non-trivial architecture/API/data/security decisions.

## Alternatives Considered

1. Keep relying only on CLAUDE.md and PR descriptions.
- Pros: Minimal process overhead.
- Cons: Critical decisions are hard to track and operational runbooks remain fragmented.

2. Introduce handbook without ADR requirements.
- Pros: Simpler initial adoption.
- Cons: Architectural decisions still become tribal knowledge.

## Consequences

### Positive

- Clear operational expectations for testing, releases, and incidents.
- Better onboarding and review consistency.
- Traceable decision history for risky technical changes.

### Negative / Trade-offs

- Slightly higher authoring overhead for non-trivial changes.
- Requires team discipline to keep docs current.

## Rollout Plan

1. Add docs under `docs/engineering/`.
2. Link handbook from `README.md` and `CLAUDE.md`.
3. Require PR checklist usage in new PRs.
4. Require ADR for breaking or high-risk design changes.

## Validation

- Handbook files present and linked.
- ADR template and first accepted ADR committed.
