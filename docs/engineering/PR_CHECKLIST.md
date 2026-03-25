# Pull Request Checklist

Use this checklist in every PR body.

## Change Scope

- [ ] Scope is focused and branch name matches intent.
- [ ] No unrelated refactors mixed into feature/fix PR.

## Correctness

- [ ] New behavior covered by tests or clear validation notes.
- [ ] Ownership/auth checks preserved for user-scoped data.
- [ ] Error states and fallbacks handled.

## Data and Migrations

- [ ] Migration required? If yes, included and reviewed.
- [ ] Rollback/forward-fix implications documented.

## Frontend Integration

- [ ] API contract changes reflected in frontend types/hooks.
- [ ] Build/type-check passes.

## Observability and Security

- [ ] Logs remain useful and do not expose secrets.
- [ ] Rate limits considered for expensive mutations.

## Documentation

- [ ] CLAUDE.md updated with new endpoints/files/patterns.
- [ ] Engineering docs/ADR updated if change is non-trivial.

## Release Notes

- [ ] User-visible behavior changes summarized.
- [ ] Operational risks and mitigations listed.
