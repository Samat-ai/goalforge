# API Governance

## Scope

Applies to all HTTP endpoints under `apps/api/routes`.

## Compatibility Policy

1. Backward-compatible additions are preferred.
2. Breaking changes require:
- ADR entry.
- Migration plan.
- Frontend/client update PR linked before merge.
3. Do not repurpose existing fields with new semantics.

## Versioning Rules

Current API is unversioned at path level.

When introducing breaking behavior:

1. Add new endpoint/field first.
2. Keep old behavior available during migration window.
3. Remove old behavior only after client cutover and release note communication.

## Endpoint Standards

- Use user ownership guards for user-scoped resources.
- Use explicit response models where practical.
- Keep summaries and docs accurate in route decorators and CLAUDE.md.
- Use deterministic fallback responses where AI is optional.

## Status Code Conventions

- `200`: read/update success.
- `201`: creation success.
- `202`: accepted async workflow.
- `204`: deletion success without body.
- `400`: client input/state invalid.
- `401`: unauthenticated.
- `403`: ownership/permission denied.
- `404`: resource not found.
- `409`: valid request conflicts with current state.
- `429`: rate limit exceeded.
- `503`: upstream/transient service unavailable.

## Deprecation Process

1. Mark endpoint/field as deprecated in docs and PR notes.
2. Add replacement endpoint/field.
3. Track migration completion.
4. Remove deprecated surface in a dedicated PR with release note.

## Observability Requirements

For new high-traffic endpoints include:

- Request ID traceability.
- Error logs with actionable context.
- Latency and failure metrics exposure plan.
