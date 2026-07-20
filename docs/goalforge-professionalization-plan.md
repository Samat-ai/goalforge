# GoalForge Professionalization & Optimization Plan

This document translates GoalForge’s current state into a practical plan that combines:
- **PM outcomes** (what users will pay for and keep using)
- **Senior SWE actions** (how to make the codebase cleaner and reusable)
- **CTO sequencing** (what to do first for maximum impact with low risk)

## 1) Product improvements to increase paid conversion and trust

### A. Clarify premium value (must-have)
1. Define a clear free vs paid boundary:
   - Free: 1 active goal, basic streak tracking, standard reminders
   - Paid: unlimited goals, advanced AI coaching, adaptive difficulty, rescue mode analytics, accountability partner insights
2. Add an in-app “Why upgrade?” screen tied to user progress moments:
   - after first goal completion
   - when user hits free-tier limit
   - when user asks for advanced coaching guidance

**Success metrics**
- Trial → paid conversion rate
- Upgrade clicks per active user
- 30-day retention for paid users

### B. Professional onboarding and activation
1. Add guided onboarding checkpoint states:
   - account created
   - first goal generated
   - first task completed
   - first weekly review viewed
2. Show contextual empty states with concrete examples for each step.

**Success metrics**
- Time-to-first-task-completion
- Activation rate (new users completing first task within 24h)

### C. Reliability and transparency features users expect
1. Add “AI generation status” UX with clear fallback states (`generating`, `ready`, `failed`).
2. Add user-visible activity history:
   - reminders sent
   - streak saver usage
   - accountability actions
3. Add explicit privacy & data policy page linked from onboarding/settings.

**Success metrics**
- AI failure recovery rate
- Support tickets per 1,000 active users

---

## 2) Engineering optimization priorities for modular, reusable code

### Priority 1: API/domain modularity
1. Keep route handlers thin and push business logic into `services/`.
2. Consolidate cross-cutting concerns into dedicated modules:
   - auth/ownership checks
   - reward and progression rules
   - AI generation orchestration + retries
3. Introduce service-level contracts (clear input/output schemas) to avoid route-layer duplication.

### Priority 2: Reduce clutter and prevent dead code
1. Add a scheduled static analysis hygiene pass:
   - Python: `ruff` dead/unused checks
   - Web: ESLint + TypeScript no-unused checks
2. Remove stale docs/links and ensure every README reference resolves.
3. Keep migration/model parity checks in CI (prevent schema drift).

### Priority 3: Reusability and consistency
1. Frontend:
   - Extract repeated UI patterns (cards, section headers, status badges) into shared components.
   - Centralize API response state handling (loading/error/empty) to common utilities.
2. Backend:
   - Standardize error response format (same shape for 4xx/5xx).
   - Centralize background job task lifecycle instrumentation (start/success/failure duration).

---

## 3) 30/60/90-day execution plan

### Day 0–30 (highest ROI, low risk)
- Define and ship free-vs-paid boundaries.
- Add upgrade prompts at key progression moments.
- Fix broken/stale documentation links and tighten contributor docs.
- Add KPI dashboard for activation, retention, and conversion.

### Day 31–60 (foundation hardening)
- Refactor duplicated business logic into service modules.
- Add shared frontend UX primitives and reusable request-state wrappers.
- Add structured logging + baseline observability for AI flows and reminder jobs.

### Day 61–90 (scale and monetization maturity)
- Ship advanced paid-only coaching and accountability insights.
- Add lifecycle email/push campaigns for churn prevention.
- Introduce experiment flags (A/B test onboarding and upgrade prompts).

---

## 4) Definition of done (industry-standard quality bar)

GoalForge should only treat this initiative as complete when:
1. **Product:** clear monetization narrative exists and is visible in-app.
2. **Engineering:** core flows are modularized with minimal route-layer logic duplication.
3. **Quality:** CI protects lint/type/test/model-migration parity.
4. **Operations:** key user and system metrics are observable and reviewed weekly.
5. **Docs:** architecture and roadmap docs are accurate, discoverable, and current.

---

## 5) Immediate next sprint backlog (ready to execute)

1. Implement paid-tier gate definitions in config and UI copy.
2. Add upgrade CTA surfaces in dashboard and weekly review endpoints/pages.
3. Add reusable frontend components for status and empty-state handling.
4. Add backend service boundary cleanup tickets by module (`goals`, `tasks`, `rewards`, `jobs`).
5. Add CI checks for:
   - unresolved docs links
   - strict lint/type settings for unused code detection
