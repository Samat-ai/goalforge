# Data Lifecycle and Compliance Notes

## Data Categories

- Identity/profile data: user ID, email, display name, timezone.
- Productivity data: goals, milestones, tasks, reflections.
- Gamification data: star points, rewards, shop redemptions.
- Notification data: push subscriptions and reminder settings.

## Data Creation

- Data is created through authenticated user actions and background generation jobs.
- AI-generated content is derived from user-provided goal context.

## Data Access

- Access is user-scoped through ownership checks.
- Internal jobs access only required fields for processing.

## Data Export

- Users can export account data via `/users/{user_id}/export`.
- Export should remain complete, user-scoped, and auditable.

## Data Deletion

- Users can delete account data via `DELETE /users/{user_id}`.
- Delete path removes dependent user-owned records through cascade semantics.

## Data Retention

- Keep only required data for product operation and analytics.
- Avoid storing unnecessary raw logs with user content.

## Compliance Operating Rules

1. Any schema change with personal data impact needs an ADR.
2. Data export/delete behavior changes require explicit test updates.
3. Incident involving user data requires dedicated postmortem section.
