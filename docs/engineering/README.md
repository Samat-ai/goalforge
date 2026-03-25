# Engineering Handbook

This folder is the operating layer for shipping GoalForge safely and quickly.

## Contents

- `ARCHITECTURE.md`: System architecture, boundaries, and critical flows.
- `API_GOVERNANCE.md`: API compatibility, versioning, and deprecation policy.
- `TESTING_STRATEGY.md`: Test pyramid, ownership, and required validation gates.
- `RELEASE_RUNBOOK.md`: Pre-release and rollback checklist.
- `INCIDENT_RESPONSE.md`: Incident severity, response workflow, and communication.
- `SECURITY_BASELINE.md`: Security standards and recurring checks.
- `DATA_LIFECYCLE.md`: Data retention, export/delete expectations, and PII handling.
- `OWNERSHIP.md`: Service and domain ownership map.
- `PR_CHECKLIST.md`: Standard PR quality checklist.
- `adr/`: Architecture Decision Records.

## Usage Rules

1. For non-trivial backend/database/API changes, create an ADR before merge.
2. For every release candidate, follow `RELEASE_RUNBOOK.md`.
3. For incidents and production regressions, follow `INCIDENT_RESPONSE.md`.
4. PRs must include the checklist in `PR_CHECKLIST.md`.
