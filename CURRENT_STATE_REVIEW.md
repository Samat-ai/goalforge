# Part 1: Principal Systems Architect — Critical Failures Only

- **Catastrophic Bug: Repeatable points inflation exploit (`PATCH /goals/{goal_id}`)**
  - **Where:** `apps/api/routes/goals.py` (`update_goal_status`)
  - **What happens:** The API awards `+100` points whenever status changes to `achieved` and previous status is not `achieved`.
  - **Exploit path:** User sets goal `achieved` → sets it back to `active` → sets to `achieved` again, farming infinite points.
  - **Impact at scale:** Full economy collapse (shop redemptions, progression stages, reward pacing become meaningless), trust erosion, potential abuse scripts.
  - **Strategic fix:** Make achievement rewards one-time and immutable per goal (e.g., `achieved_at` + `achievement_reward_granted` flag in DB, transactionally enforced with row lock + conditional update).

- **Critical Reliability Debt: In-process background execution for core workflow is non-durable**
  - **Where:** `apps/api/routes/goals.py` (`BackgroundTasks.add_task(_generate_goal_async)`), `apps/api/services/task_service.py` (`asyncio.create_task(_pre_generate_sprint)`)
  - **What happens:** Goal generation and sprint pre-generation run only in app process memory. Worker restarts/deploys/crashes lose jobs.
  - **Impact at 10k users:** Randomly stuck goals, silent task generation drops, user-facing “generating…” dead-ends, support burden spikes.
  - **Strategic fix:** Move long-running AI generation to a durable queue + worker system with retries, backoff, idempotency keys, and dead-letter handling.

- **Critical Concurrency Debt: No idempotency fence on goal-generation workers**
  - **Where:** `apps/api/services/goal_service.py` (`_generate_goal_async` deletes and rewrites milestones/tasks)
  - **What happens:** Multiple generation attempts on the same goal can race (initial run + retries), causing destructive rewrites of milestone/task state.
  - **Impact at scale:** Task duplication/loss or user-visible plan mutation after they already started execution.
  - **Strategic fix:** Introduce generation versioning or compare-and-swap state transitions (`generating_version`/`generation_token`) so stale workers cannot overwrite newer state.

- **Critical Throughput Risk: AI fan-out without global backpressure control**
  - **Where:** `apps/api/services/task_service.py` pre-generation path
  - **What happens:** User activity can spawn large concurrent Gemini calls; no global queue limits, no admission control, no tenant fairness.
  - **Impact at 10k users:** API latency spikes, timeout cascades, unpredictable cost blowouts, and cascading retries.
  - **Strategic fix:** Centralized job scheduling with concurrency quotas, per-user and global rate ceilings, and circuit-breaker behavior under provider degradation.

- **Security & Exploits (high confidence scan):**
  - Ownership checks are broadly present (`_ensure_owner`, `_load_*_with_ownership`) across goals/tasks/rewards/shop/accountability/push routes.
  - Jobs endpoint enforces API key (`/api/jobs/trigger-reminders`).
  - **Primary exploit found is points inflation via status toggling** (above), which is currently the most severe business-logic security failure.

---

# Part 2: Head of Product & Growth — The Engagement Engine

- **Core Loop Churn Analysis (Input Goal → AI Breakdown → Complete Tasks → Earn Points):**
  - **Highest churn point #1: “AI generation limbo” immediately after goal submission.**
    - Users see a generating state and must wait/poll (`useGoals` every 5s) before actionable tasks appear.
    - If generation fails or stalls, first-session motivation collapses before the first dopamine hit.
  - **Highest churn point #2: “No guaranteed first win” in first 2 minutes.**
    - If the first generated tasks feel too large, new users (especially low motivation users) bounce before first completion.
  - **Highest churn point #3: Progression meaning flattening.**
    - Stage thresholds are clear, but progression lacks strong “chapter unlock” moments tied to identity/social proof.

- **Must-Have Features (pre-launch):**

  - **Feature Name:** First-Session Instant Win Mode
    - **What it does:** Guarantees one ultra-small “2-minute victory task” appears instantly (before full plan generation completes).
    - *The User Benefit (Why it keeps them engaged):* Users get an immediate completion + reward spike in the first session, reducing onboarding abandonment.

  - **Feature Name:** Durable AI Job Center
    - **What it does:** Adds a transparent “Plan Status” panel with job states (queued/generating/retry-ready), ETA signals, and one-tap recovery actions.
    - *The User Benefit (Why it keeps them engaged):* Removes uncertainty and frustration during AI wait states; users trust the system and don’t churn during delays.

  - **Feature Name:** Commitment Contracts (Personal + Social)
    - **What it does:** Lets users declare a weekly commitment with optional accountability partner visibility and completion summaries.
    - *The User Benefit (Why it keeps them engaged):* Converts private intent into visible commitment pressure, improving weekly return rate.

  - **Feature Name:** Adaptive Task Sizing Engine v2
    - **What it does:** Continuously shrinks/expands task difficulty based on real completion behavior and missed-day patterns, not just sprint boundaries.
    - *The User Benefit (Why it keeps them engaged):* Prevents overwhelm on bad days and boredom on strong days, preserving a “doable but meaningful” flow.

  - **Feature Name:** Weekly Narrative Recap + Next Week Quest
    - **What it does:** Turns weekly performance into a short personalized story plus a single “primary quest” for the next 7 days.
    - *The User Benefit (Why it keeps them engaged):* Creates emotional continuity and a clear re-entry point each week.

---

# Part 3: Lead Gamification & Market Strategist — Competitive Evolution

- **Competitor Mechanics (why users stay years):**
  - **Habitica:**
    - Strong **loss aversion** (HP damage for misses), **social obligation** (party quests/guilds), and **variable rewards** (gear/drops).
    - Identity persistence via avatar progression and collectibles creates long-term sunk emotional investment.
  - **Finch:**
    - Powerful **emotional attachment loop** (care for a companion), **low-friction self-care prompts**, and non-judgmental re-entry.
    - Daily reflection + mood-oriented interaction keeps usage resilient even when productivity dips.

- **How GoalForge should adopt and improve (not copy):**
  - Convert static rewards into **AI-personalized symbolic rewards** (titles/lore/themes generated from user’s own completed task history).
  - Add **dynamic companion intelligence**: instead of a fixed pet, create an AI “Forge Spirit” that changes personality arcs based on behavior patterns (consistency, comeback, focus time).
  - Build **micro-party accountability quests** around real goals (2–4 people), where AI adapts quest milestones to each member’s level but gives shared win moments.
  - Use **contextual re-entry scripts** (AI-generated comeback plans) after inactivity rather than generic reminders.

- **Dopamine Design: Evolve “Speck → Celestial” system**
  - Add **three reward tempos**:
    - **Short-term (minutes):** completion pop + variable micro-drop odds + immediate visual companion reaction.
    - **Mid-term (days):** streak-protected “momentum shield” and 3-day mini-chapter unlocks.
    - **Long-term (weeks):** stage ascension ceremonies with unlockable mechanics, not only cosmetics.
  - Replace linear points feel with **milestone-based breakthrough moments**:
    - “Ascension windows” (e.g., last 10 points to next stage trigger heightened event feedback).
    - “Comeback multipliers” for users returning after lapses to reduce shame and increase restart probability.
  - Tie stage meaning to capability:
    - Higher stages unlock better planning powers (e.g., advanced AI coaching modes, custom quest archetypes), not just labels.

---

# Part 4: The 7-Day Retention Blueprint (ADHD / Low Motivation Persona)

- **Day 1 (Onboarding + emotional safety + first win):**
  - **Psychological state:** Excited but fragile; overwhelm risk is highest.
  - **What GoalForge must do:**
    - Provide one tiny guaranteed task instantly (“Open notebook and write one bullet”).
    - Show only one priority action at a time (hide full complexity until first completion).
    - Deliver immediate reinforcement: visual reward + encouraging AI micro-feedback tied to action.
  - **Push / AI check-in examples:**
    - “No pressure: one 2-minute step is enough today. Want me to pick it for you?”
    - “You already started momentum. One tap and I’ll set your easiest next move.”

- **Day 3 (friction management + anti-shame recovery):**
  - **Psychological state:** Novelty dropping; avoidance patterns start.
  - **What GoalForge must do:**
    - Detect missed tasks and auto-switch to reduced cognitive load mode (2-task rescue sprint).
    - Use “restart language” (no guilt framing), and pre-fill an ultra-small comeback action.
    - Offer optional accountability ping to one trusted partner.
  - **Push / AI check-in examples:**
    - “Rough day mode is on. I shrank today’s plan to 2 tiny wins.”
    - “You’re not behind—you’re resuming. Do the 90-second version?”

- **Day 7 (identity lock-in + future commitment):**
  - **Psychological state:** User decides whether this app is ‘for me’ or ‘another abandoned tool’.
  - **What GoalForge must do:**
    - Deliver a short personalized weekly narrative (what they overcame, not just metrics).
    - Ask for one explicit commitment for next week (time window + anchor habit).
    - Show a visible near-future reward path (“2 completions to next ascension event”).
  - **Push / AI check-in examples:**
    - “Week 1 complete. You kept promises on hard days—that’s your superpower.”
    - “Pick your next week anchor: morning, lunch, or evening? I’ll protect it for you.”

- **Notification cadence guardrails (to avoid overwhelm):**
  - Max 1 core nudge + 1 optional follow-up per day.
  - Adaptive silence when user is stressed/inactive unless rescue mode is enabled.
  - Every nudge must be actionable in <10 seconds (tap opens directly to one task).
