# Architecture Decision Records (ADR)

Use ADRs for non-trivial technical decisions affecting architecture, API compatibility, data model, or operational behavior.

## Required When

- Introducing breaking API behavior.
- Adding/changing database schema with operational risk.
- Changing auth/ownership/security-critical behavior.
- Introducing major new infra/runtime dependencies.

## Process

1. Copy `TEMPLATE.md` to `ADR-XXXX-short-title.md`.
2. Fill context, decision, alternatives, consequences.
3. Link ADR in PR body before merge.
4. Update ADR status if superseded.

## Status Values

- Proposed
- Accepted
- Deprecated
- Superseded
