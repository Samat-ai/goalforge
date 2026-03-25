# Incident Response Runbook

## Severity Levels

- Sev 1: Core product unusable or data integrity/security risk.
- Sev 2: Major feature degraded for many users.
- Sev 3: Limited-scope issue or acceptable workaround exists.

## First 15 Minutes

1. Declare severity in incident channel.
2. Assign roles:
- Incident Commander
- Primary Investigator
- Communications Owner
3. Capture impact statement and start timestamp.
4. Stabilize first (rollback/feature flag/traffic reduction).

## Investigation Flow

1. Check latest deploys and migrations.
2. Inspect request-ID correlated logs.
3. Identify blast radius:
- Endpoint(s)
- User segment(s)
- Data tables affected
4. Decide mitigation vs full rollback.

## Communication Cadence

- Sev 1: every 15 minutes.
- Sev 2: every 30 minutes.
- Sev 3: hourly until contained.

Each update includes:

- Current impact.
- Mitigation in progress.
- Next update ETA.

## Recovery and Closure

1. Confirm metrics back to baseline.
2. Validate critical user journeys.
3. Close incident with final summary.

## Postmortem (within 48 hours)

Required sections:

1. Timeline.
2. Root cause.
3. Detection gaps.
4. What worked.
5. Action items with owners and due dates.
