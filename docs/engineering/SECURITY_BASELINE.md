# Security Baseline

## Authentication and Authorization

- All user-scoped routes must enforce authenticated user ownership.
- Do not bypass auth in production paths.
- Jobs/cron routes require API key or equivalent service auth.

## Secrets Management

- No secrets committed to repository.
- Rotate API keys when exposure is suspected.
- Use environment variables for runtime secret injection.

## Input and AI Safety

- Validate request payloads with strict schemas.
- Use bounded retries/timeouts for AI calls.
- Provide deterministic fallback behavior on AI failure.

## Dependency Hygiene

- Update dependencies regularly.
- Run vulnerability audits in CI pipeline.
- Track exceptions with explicit risk acceptance notes.

## Logging and PII

- Do not log sensitive tokens or secrets.
- Keep request IDs in all logs for traceability.
- Redact or avoid logging user-provided sensitive content.

## Secure Coding Requirements

- Use SQLAlchemy parameterized query patterns only.
- Use atomic SQL updates for balance/point changes.
- Add rate limits to high-cost mutation endpoints.

## Security Review Triggers

Require explicit review when changing:

- Auth/JWT validation logic.
- Ownership checks in deps/routes.
- Jobs endpoint auth model.
- Data export/delete behavior.
