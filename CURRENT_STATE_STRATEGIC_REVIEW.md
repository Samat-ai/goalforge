# GoalForge Current-State Strategic Review (Main Branch)

## Part 1: Principal Systems Architect (Critical Failures Only)

- **Catastrophic Bug: milestone advancement can silently strand users in empty “active” sprints**
  - In `/goals/{goal_id}/milestones/{milestone_id}/complete`, if the next sprint is still `"generating"`, code sets it to `"active"` immediately (`apps/api/routes/milestones.py`), even if tasks are not yet persisted by pre-gen.
  - If background pre-gen later fails, milestone can remain `"active"` with no usable task set until manual retry, which is a hard engagement break.
  - At 10k users, this creates a high-volume “dead sprint” failure mode that looks like data corruption from the user’s perspective.

- **Catastrophic Scale Risk: unbounded in-process async pre-generation**
  - `complete_task_and_award_points()` spawns `asyncio.create_task()` for pre-generation (`apps/api/services/task_service.py`) and tracks tasks in `_background_tasks`.
  - `_background_tasks` is a **module-level in-memory set** in the API process, so lifecycle and load-shedding are tied to each app instance, not a durable shared queue.
  - This is still process-local queueing with no backpressure, no centralized worker, and no global concurrency cap.
  - Under burst load, DB connections and memory pressure can spike faster than request throughput can recover, producing cascading latency and stuck generations.

- **Catastrophic Throughput Risk: database pool sizing is undersized for fan-out background generation**
  - DB pool is configured at `pool_size=10`, `max_overflow=20` (`apps/api/config.py`, `apps/api/database.py`).
  - Completion traffic can trigger concurrent AI pre-gen writes from many requests, which competes with foreground API traffic for the same pool.
  - At scale, this becomes connection starvation: user-facing routes slow down, background commits fail, and sprint states drift.

- **Critical Concurrency Debt: points economy updates rely on optimistic status checks, not strict transactional idempotency at business-event level**
  - Goal achievement awards +100 points when transitioning to `"achieved"` (`apps/api/routes/goals.py`), task completion awards points in reward flow (`apps/api/services/reward_service.py`, `apps/api/routes/tasks.py`).
  - Current protections are good but still distributed across route/service logic rather than event-level idempotency keys.
  - Under retries/replays/network duplication, this increases long-term risk of inconsistent economic state.

- **Security & Exploits: what is actually dangerous now**
  - **IDOR posture is mostly solid**: ownership checks exist in shared deps (`apps/api/deps.py`) and are used by goal/task/reward mutations.
  - **High-impact exposure remains the jobs endpoint blast radius**: `/api/jobs/trigger-reminders` is API-key protected (`apps/api/routes/jobs.py`) and bypasses user auth by design. If key leaks, attacker can trigger global reminder/rescue flows and force outbound email volume.
    - **Required mitigations before scale**: rotateable short-lived job key strategy, IP allowlisting at edge, per-minute rate limiting on this route, and anomaly alerts on rescue/digest send spikes.
  - **Abuse/DoS vector**: critical mutation endpoints are unevenly rate-limited (goal create and some milestone ops are limited; task completion is not), enabling request flooding against high-write paths.

---

## Part 2: Head of Product & Growth (The Engagement Engine)

- **Core Loop Risk Analysis (Input Goal → AI Breakdown → Complete Tasks → Earn Points)**
  - **Highest churn point #1: “AI is thinking” uncertainty at onboarding**
    - Goal creation is two-phase and returns placeholder state first (`apps/api/routes/goals.py` + `apps/web/src/components/AddGoal.tsx`).
    - If generation is slow/fails, user perception is “I did the hard part and got nothing useful.”
  - **Highest churn point #2: sprint transition fragility**
    - Completing a sprint can route through pre-generated, generating, failed, or synchronous fallback paths (`apps/api/routes/milestones.py`).
    - Any delay here breaks momentum at the exact moment user expects reward.
  - **Highest churn point #3: reward visibility mismatch**
    - Most completions are standard +10 points, while collectible moments are rarer (`apps/api/services/reward_service.py`).
    - Users feel effort, but don’t always feel *meaningful progression* in-session.
  - **Highest churn point #4: cognitive overload for low-energy users**
    - Today + overdue + full task list can still feel heavy, even with Focus mode and “Do This Now” helpers (`apps/web/src/pages/Dashboard.tsx`, `apps/web/src/components/TodayBar.tsx`).

- **Must-Have Feature Roadmap (Pre-Launch)**
  - **Feature Name:** Reliable Generation State Machine + ETA UX
    - **What it does:** Guarantees every goal/sprint generation has explicit states (`queued`, `running`, `ready`, `failed`, `retrying`) with visible ETA and deterministic fallback.
    - **The User Benefit (Why it keeps them engaged):** Removes the “is this broken?” moment and protects trust during first-session onboarding.

  - **Feature Name:** Anti-Abandonment “First Win in <60s”
    - **What it does:** Immediately produces one guaranteed micro-task (non-AI fallback) after goal input, then backfills richer AI plan.
    - **The User Benefit (Why it keeps them engaged):** User gets instant action + instant accomplishment before any model latency can cause churn.

  - **Feature Name:** Dynamic Reward Pacing Layer
    - **What it does:** Adds adaptive reward pacing (e.g., streak-protection rewards, near-miss bonuses, milestone-completion bursts) based on recent behavior.
    - **The User Benefit (Why it keeps them engaged):** Converts “just +10 again” into variable reinforcement that feels alive and personally responsive. In practice, this means reward timing and intensity are intentionally non-identical, which is usually more habit-forming than perfectly fixed rewards.

  - **Feature Name:** Recovery Protocol (Not Just Rescue Sprint)
    - **What it does:** When inactivity is detected, app shifts from normal planning to low-friction recovery mode (tiny tasks, reduced UI complexity, confidence rebuilding).
    - **The User Benefit (Why it keeps them engaged):** Makes return psychologically safe instead of shame-triggering.

  - **Feature Name:** Retention Messaging Orchestrator
    - **What it does:** Notification cadence tied to user state (new, wobbling, lapsing, recovering) rather than fixed reminders.
    - **The User Benefit (Why it keeps them engaged):** Nudges feel helpful and timely, not noisy or guilt-driven.

---

## Part 3: Lead Gamification & Market Strategist (Competitive Evolution)

- **Competitor Mechanics: Why Habitica and Finch retain users for years**
  - **Habitica strengths**
    - Social accountability loops (parties, challenges, shared consequences/rewards).
    - Strong loss aversion and commitment mechanics (missed dailies matter).
    - Long-horizon collection/progression economy with identity signaling.
  - **Finch strengths**
    - Emotional companionship model (pet growth tied to self-care consistency).
    - Gentle, non-punitive reinforcement with mood-safe tone.
    - Daily ritualization and reflective prompts that reduce friction to re-entry.
  - **Retention principle both exploit:** users return for *relationship + identity continuity*, not task checklists alone.

- **The GoalForge Evolution (Adopt + Improve, not copy)**
  - Turn static progression into **AI-personalized narrative progression**:
    - Instead of generic unlock text, generate evolving “star log” chapters from user’s actual completed task history.
  - Upgrade collections into **meaningful utility rewards**:
    - Unlocks should affect real behavior: adaptive focus themes, custom AI coach voices, rescue-mode powers, streak insurance.
  - Add **micro-social without social pressure**:
    - Anonymous cohort arcs (“people on week-2 fitness arc”) and opt-in cooperative quests where contribution is private but group momentum is visible.
  - Create **adaptive challenge calibration**:
    - If user overperforms, increase challenge quality; if user stalls, auto-fragment tasks and reduce execution friction.

- **Dopamine Design: Evolve “Speck → Celestial”**
  - **Short-term hits (session-level)**
    - Add “near-term certainty” rewards every 2–3 actions (audio/visual unlock pings, tiny streak multipliers, micro-lore reveals).
    - Use variable ratio rewards, but cap long periods without rewards so users never feel ignored.
  - **Mid-term hits (week-level)**
    - Weekly “constellation completion” arcs that reset with novelty (new mini-theme, mini-boss challenge, recovery badge).
  - **Long-term hits (identity-level)**
    - Replace flat endpoint with **prestige constellations** after Celestial: user can re-specialize (Scholar, Builder, Athlete, etc.) while retaining legacy status.
  - **Critical improvement**
    - Progression should not only be “more points”; it should unlock new *agency* and *self-story*.

---

## Part 4: The 7-Day Retention Blueprint (ADHD + Low Motivation Persona)

- **Day 1 (Onboarding): prevent immediate overwhelm**
  - **Psychological job:** reduce intimidation and secure a fast competence win.
  - **What GoalForge must do:**
    - Ask for one goal, then instantly return one 2-minute micro-task (no waiting wall).
    - Show only one primary CTA: “Do this now (2 minutes).”
    - After completion, celebrate visibly and show “You are now in motion” state.
  - **Push / AI check-in / UI nudge examples:**
    - Push (2 hours later): “You already started. Want a 90-second win to keep momentum?”
    - In-app AI check-in: “Energy low / medium / high?” → task auto-resized.
    - UI nudge: hide everything except today’s single best next action until user asks for more.

- **Day 3 (First motivation dip): prevent shame spiral**
  - **Psychological job:** normalize inconsistency and re-enable action without penalty feelings.
  - **What GoalForge must do:**
    - Trigger Recovery Protocol if activity drops.
    - Reframe lapse: “No reset needed. We continue from here.”
    - Offer a one-tap restart with one tiny task and one guaranteed reward moment.
  - **Push / AI check-in / UI nudge examples:**
    - Push: “No catch-up marathon. One tiny step is enough today.”
    - AI check-in: “Want the easy version? I can shrink today’s task to 3 minutes.”
    - UI nudge: replace overdue list with “Recover with 1 task” card.

- **Day 7 (Retention cliff): convert effort into identity**
  - **Psychological job:** make user feel transformed, not merely compliant.
  - **What GoalForge must do:**
    - Deliver a 7-day reflection artifact (before/after narrative generated from their own actions).
    - Present next-week arc as a continuation of identity (“You’re becoming someone who…”).
    - Offer one meaningful unlock tied to their pattern (not random cosmetic only).
  - **Push / AI check-in / UI nudge examples:**
    - Push: “7-day snapshot is ready — you’ve built real momentum.”
    - AI check-in: “Choose your Week 2 mode: Gentle, Balanced, or Ambitious.”
    - UI nudge: “Lock in Week 2 with one click” with pre-tuned plan.
