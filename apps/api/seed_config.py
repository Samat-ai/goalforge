"""
Demo data constants for the seed script.
Realistic goal content, task descriptions, and narrative text.
"""

# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

DEMO_GOALS = [
    {
        "raw_input": "I want to run a 5K in under 30 minutes",
        "smart_title": "Complete a 5K Run in Under 30 Minutes",
        "smart_description": (
            "Transform from a casual walker to a confident 5K runner by following a structured "
            "12-week training program with progressive overload. Track every run, prioritise "
            "consistency over speed, and race on the final week."
        ),
        "goal_type": "health",
        "progress": 60,
        "status": "active",
        "achievement_reward_granted": False,
        "weeks_until_target": 8,
        "milestones": [
            {
                "title": "Build Running Base",
                "position": 0,
                "is_final": False,
                "sprint_theme": "Establish a habit of running 3 times per week at easy pace",
                "sprint_status": "completed",
                "is_completed": True,
            },
            {
                "title": "Increase Endurance",
                "position": 1,
                "is_final": False,
                "sprint_theme": "Extend long runs and add interval training to build aerobic base",
                "sprint_status": "active",
                "is_completed": False,
            },
            {
                "title": "Speed Work",
                "position": 2,
                "is_final": False,
                "sprint_theme": "Introduce tempo runs and strides to push pace below 10 min/mile",
                "sprint_status": "ready",
                "is_completed": False,
            },
            {
                "title": "Race Prep",
                "position": 3,
                "is_final": True,
                "sprint_theme": "Taper, practise race-day routine, and compete in a 5K event",
                "sprint_status": "pending",
                "is_completed": False,
            },
        ],
    },
    {
        "raw_input": "Learn TypeScript and build a side project",
        "smart_title": "Master TypeScript and Ship a Side Project",
        "smart_description": (
            "Go from JavaScript-only developer to confident TypeScript user by completing the "
            "official handbook, building a React + TypeScript todo app, then launching a polished "
            "portfolio project to GitHub Pages within 10 weeks."
        ),
        "goal_type": "learning",
        "progress": 30,
        "status": "active",
        "achievement_reward_granted": False,
        "weeks_until_target": 7,
        "milestones": [
            {
                "title": "TypeScript Fundamentals",
                "position": 0,
                "is_final": False,
                "sprint_theme": "Cover types, interfaces, generics, and utility types from the official docs",
                "sprint_status": "active",
                "is_completed": False,
            },
            {
                "title": "React + TypeScript Project",
                "position": 1,
                "is_final": False,
                "sprint_theme": "Build a full-featured task manager app with typed props, hooks, and API calls",
                "sprint_status": "pending",
                "is_completed": False,
            },
            {
                "title": "Launch & Polish",
                "position": 2,
                "is_final": True,
                "sprint_theme": "Add tests, write a README, deploy to GitHub Pages, and share with the community",
                "sprint_status": "pending",
                "is_completed": False,
            },
        ],
    },
    {
        "raw_input": "Save $5,000 emergency fund",
        "smart_title": "Build a $5,000 Emergency Fund",
        "smart_description": (
            "Reach full financial security by saving $5,000 across six months using automated "
            "transfers, expense tracking, and monthly budget reviews. Celebrate each $1,000 "
            "milestone along the way."
        ),
        "goal_type": "finance",
        "progress": 100,
        "status": "achieved",
        "achievement_reward_granted": True,
        "weeks_until_target": -4,  # already past target date
        "milestones": [
            {
                "title": "First $1,000 Saved",
                "position": 0,
                "is_final": False,
                "sprint_theme": "Cut unnecessary subscriptions and automate $200/week transfer",
                "sprint_status": "completed",
                "is_completed": True,
            },
            {
                "title": "Reach $2,500 Halfway Mark",
                "position": 1,
                "is_final": False,
                "sprint_theme": "Add a side income stream and maintain the automated savings habit",
                "sprint_status": "completed",
                "is_completed": True,
            },
            {
                "title": "Push to $4,000",
                "position": 2,
                "is_final": False,
                "sprint_theme": "Reduce dining-out budget and redirect surplus to the fund",
                "sprint_status": "completed",
                "is_completed": True,
            },
            {
                "title": "Hit $5,000 and Celebrate",
                "position": 3,
                "is_final": True,
                "sprint_theme": "Final sprint — reach the target and set up the fund in a high-yield account",
                "sprint_status": "completed",
                "is_completed": True,
            },
        ],
    },
]

# ---------------------------------------------------------------------------
# Task pools
# ---------------------------------------------------------------------------

DEMO_TASKS = {
    "running": [
        {
            "description": "Complete a 20-minute easy jog at conversational pace",
            "tip": "If you can't hold a conversation, slow down — aerobic base matters most",
        },
        {
            "description": "Do 3 sets of 10 bodyweight squats for leg strength",
            "tip": "Keep your knees tracking over your toes and drive through your heels",
        },
        {
            "description": "Run 5 x 1-minute intervals with 90-second walking recovery",
            "tip": "Run the fast intervals at an effort where talking feels hard but not impossible",
        },
        {
            "description": "Walk 30 minutes as an active recovery session",
            "tip": "Recovery days are when adaptation actually happens — don't skip them",
        },
        {
            "description": "Track your resting heart rate first thing in the morning",
            "tip": "A rising resting HR can signal overtraining or poor sleep before you feel it",
        },
        {
            "description": "Complete a 25-minute continuous run without stopping",
            "tip": "Pick a route with minimal traffic crossings so you don't break stride",
        },
        {
            "description": "Do a 10-minute dynamic warm-up before your run",
            "tip": "Leg swings, hip circles, and high knees prep your joints better than static stretching",
        },
        {
            "description": "Run 3 x 2-minute tempo intervals at a comfortably hard effort",
            "tip": "Tempo pace is where you could speak a short sentence but nothing more",
        },
        {
            "description": "Log your run distance and average pace in your training journal",
            "tip": "Even a rough estimate is better than nothing — patterns emerge over weeks",
        },
        {
            "description": "Do 10 minutes of post-run foam rolling on your calves and IT band",
            "tip": "Slow, sustained pressure on tight spots works better than rolling back and forth fast",
        },
        {
            "description": "Complete a long slow run of 35 minutes at easy pace",
            "tip": "Long runs build your aerobic engine — keep the effort genuinely easy",
        },
        {
            "description": "Practice 30 seconds of fast strides at end of easy run",
            "tip": "Strides teach your legs to turn over quickly without taxing your energy system",
        },
        {
            "description": "Check your running shoes for wear — replace if over 500 miles",
            "tip": "Worn-out shoes are a leading cause of overuse injuries in new runners",
        },
        {
            "description": "Run 4 x 3-minute intervals with 2-minute jog recovery",
            "tip": "Focus on smooth form rather than maximum speed during each interval",
        },
        {
            "description": "Do a 5-minute plank and core circuit for running stability",
            "tip": "A strong core prevents the hip drop that wastes energy with every stride",
        },
        {
            "description": "Complete a 30-minute run and note how the last 5 minutes felt",
            "tip": "Learning to read effort at the end of a run helps you pace 5K races correctly",
        },
        {
            "description": "Research local 5K events and register for one within 6 weeks",
            "tip": "A race entry date creates real accountability that no training plan can match",
        },
        {
            "description": "Try running on a soft trail or grass to reduce impact stress",
            "tip": "Off-road running recruits stabilising muscles that pavement running misses",
        },
    ],
    "running_rescue": [
        {
            "description": "Do a 15-minute walk to keep your body moving after missing yesterday",
            "tip": "Momentum is easier to restart than to rebuild from zero — any movement counts",
        },
        {
            "description": "Stretch your hip flexors and hamstrings for 10 minutes",
            "tip": "Tight hips are the hidden culprit behind most beginner running pain",
        },
        {
            "description": "Watch a 10-minute video on proper running form and take one note",
            "tip": "Even one cue — like 'land under your hips' — can transform your efficiency",
        },
    ],
    "typescript": [
        {
            "description": "Complete the TypeScript handbook section on basic types",
            "tip": "Pay special attention to 'unknown' vs 'any' — it's where most bugs hide",
        },
        {
            "description": "Write a typed function that accepts a generic array and returns the first element",
            "tip": "Generics are like function parameters for types — start simple and build intuition",
        },
        {
            "description": "Convert a small JavaScript utility file to TypeScript with strict mode",
            "tip": "Strict mode catches far more errors than the default — enable it from day one",
        },
        {
            "description": "Read and practise TypeScript's interface vs type alias distinctions",
            "tip": "Prefer interfaces for object shapes and type aliases for unions and intersections",
        },
        {
            "description": "Implement a typed API response wrapper using generics",
            "tip": "A well-typed wrapper eliminates an entire class of null-access bugs in one shot",
        },
        {
            "description": "Study the Partial<T>, Required<T>, and Pick<T, K> utility types",
            "tip": "Utility types let you transform existing types without duplicating code",
        },
        {
            "description": "Add TypeScript to an existing React component and type all props",
            "tip": "Start with the simplest component — confidence builds fast once types click",
        },
        {
            "description": "Write a discriminated union for a fetch state (loading, success, error)",
            "tip": "Discriminated unions make impossible states impossible — one of TypeScript's killer features",
        },
        {
            "description": "Practise TypeScript enums and learn why const enums are often preferred",
            "tip": "const enums are erased at compile time and produce no runtime overhead",
        },
        {
            "description": "Set up a tsconfig.json with strict, noUnusedLocals, and noImplicitReturns",
            "tip": "A strict tsconfig on day one is much easier than retrofitting it later",
        },
        {
            "description": "Complete one TypeScript exercise on type-challenges GitHub repo",
            "tip": "Solving type puzzles builds muscle memory faster than reading documentation",
        },
        {
            "description": "Type a custom React hook that fetches data and handles loading state",
            "tip": "Custom hooks are where generic TypeScript really shines in practice",
        },
        {
            "description": "Read the TypeScript deep dive chapter on declaration files (.d.ts)",
            "tip": "Understanding .d.ts files unlocks the ability to type any third-party library",
        },
        {
            "description": "Refactor a class-based component to a typed functional component",
            "tip": "React.FC<Props> gives you children for free — but explicit props are often clearer",
        },
        {
            "description": "Write unit tests for a TypeScript utility function using Vitest",
            "tip": "Tests and TypeScript together form a safety net that lets you refactor fearlessly",
        },
    ],
    "savings": [
        {
            "description": "Review last month's bank statement and categorise every expense",
            "tip": "You can't optimise what you haven't measured — one hour now saves hundreds later",
        },
        {
            "description": "Identify and cancel one subscription you haven't used in 30 days",
            "tip": "Small recurring costs are the silent killers of savings goals",
        },
        {
            "description": "Set up an automatic transfer of $50 to your savings account for this Friday",
            "tip": "Automating savings removes willpower from the equation entirely",
        },
        {
            "description": "Calculate your current savings rate as a percentage of take-home pay",
            "tip": "Knowing your rate makes every spending decision feel more concrete",
        },
        {
            "description": "Meal prep lunches for the next three days to avoid eating out",
            "tip": "A $12 lunch eaten five days a week adds up to over $3,000 a year",
        },
        {
            "description": "Research one high-yield savings account and note the current APY",
            "tip": "Your emergency fund should earn interest — even 4% on $5,000 is $200/year",
        },
        {
            "description": "Log today's spending in your budget tracker before midnight",
            "tip": "Daily logging takes 2 minutes and makes weekly reviews almost effortless",
        },
        {
            "description": "Negotiate a lower rate on one recurring bill (internet, phone, or insurance)",
            "tip": "A five-minute call can save $20–$50/month with zero lifestyle impact",
        },
        {
            "description": "Check your emergency fund balance and update your progress tracker",
            "tip": "Seeing the number grow is one of the most powerful motivators in personal finance",
        },
        {
            "description": "Cook dinner at home instead of ordering takeout tonight",
            "tip": "Home-cooked meals typically cost 60–80% less than equivalent restaurant meals",
        },
        {
            "description": "Find one item around the house to sell on a local marketplace",
            "tip": "Clutter clearing is a savings hack — it declutters your space and funds your goal",
        },
        {
            "description": "Read one article on building an emergency fund vs. investing",
            "tip": "Understanding the rationale behind the fund makes it easier to stay motivated",
        },
    ],
    "savings_rescue": [
        {
            "description": "Transfer any spare change from your wallet to your savings jar",
            "tip": "Physical coins in a jar are surprisingly motivating — small wins still count",
        },
        {
            "description": "Skip one impulse buy today and note what you saved",
            "tip": "A simple pause of 10 seconds before buying is enough to break most impulse habits",
        },
    ],
}

# ---------------------------------------------------------------------------
# Coach session messages
# ---------------------------------------------------------------------------

DEMO_COACH_MESSAGES = [
    {
        "role": "coach",
        "content": (
            "I'm your GoalForge coach. Let's build something real today. "
            "What transformation do you most want to achieve in the next 90 days — "
            "and why does it matter to you right now?"
        ),
    },
    {
        "role": "user",
        "content": (
            "I want to go from barely being able to run a mile to completing a 5K in under "
            "30 minutes. I've been saying I'll 'get fit' for two years and nothing ever sticks. "
            "I need a concrete target this time."
        ),
    },
    {
        "role": "coach",
        "content": (
            "That's a strong, measurable goal — 5K in under 30 minutes is absolutely achievable "
            "in 12 weeks with consistent effort. Before we build the plan, tell me: "
            "what has stopped you from following through in the past? Be specific."
        ),
    },
    {
        "role": "user",
        "content": (
            "Mostly I'd miss one day because of work or weather, then feel like I'd 'broken' "
            "the streak and just stop entirely. Also I'd try to run too fast too soon and "
            "get shin splints, which gave me an excuse to quit."
        ),
    },
    {
        "role": "coach",
        "content": (
            "Classic all-or-nothing trap — and very common. The fix is building a system that "
            "expects imperfection. If you miss a day, the plan already accounts for it. "
            "Now: what does your current weekly schedule look like? "
            "Which three days could you realistically commit 30–40 minutes to running?"
        ),
    },
    {
        "role": "user",
        "content": (
            "Monday, Wednesday, and Saturday mornings work best. I'm usually free by 7am "
            "on those days before the family wakes up. That window feels protected."
        ),
    },
    {
        "role": "coach",
        "content": (
            "Perfect — early mornings before the household starts are one of the most reliable "
            "training windows. Last question before I build your plan: "
            "on a scale of 1–10, how committed are you to this goal? "
            "And what would make it a 10 if it isn't already?"
        ),
    },
    {
        "role": "user",
        "content": (
            "I'd say 8 out of 10. The missing 2 points are around what happens when travel or "
            "illness disrupts things. I don't have a recovery strategy yet — "
            "that's usually where I fall off."
        ),
    },
    {
        "role": "coach",
        "content": (
            "Good self-awareness. We'll bake in rescue tasks for disrupted weeks — lighter "
            "activities that keep momentum without adding injury risk. "
            "Your goal is clear: 5K in under 30 minutes, Monday / Wednesday / Saturday, "
            "12-week structured plan. Ready to lock it in?"
        ),
    },
    {
        "role": "user",
        "content": (
            "Yes, let's do it. I'm actually excited about this for the first time in a while. "
            "Having it broken into milestones makes it feel less overwhelming."
        ),
    },
]

# ---------------------------------------------------------------------------
# Star log narratives
# ---------------------------------------------------------------------------

DEMO_STAR_LOG_NARRATIVES = [
    {
        "chapter_title": "The Reluctant Runner Laces Up",
        "chapter_body": (
            "Week 1 found you taking your first tentative steps on a journey you've been "
            "postponing for months. You completed 18 of 21 tasks — an 86% rate that would make "
            "any veteran runner proud. The Monday morning runs were harder than expected, but you "
            "showed up before the house was awake. That counts more than the pace.\n\n"
            "The shin tightness on Wednesday was a warning you heeded rather than ignored. "
            "Swapping the evening run for a foam-rolling session was the right call — not a "
            "failure of will, but evidence of growing wisdom. Runners who listen to their bodies "
            "in week one are still running in week twelve.\n\n"
            "One line from your training log stood out: 'It hurt, but it was my hurt.' "
            "That ownership is everything."
        ),
        "highlights": [
            "18/21 tasks completed — 86% success rate in week one",
            "Recognised shin tightness early and adapted the plan",
            "Established the pre-dawn Monday training window",
        ],
        "completed_tasks": 18,
        "completed_days": 5,
        "is_fallback": False,
    },
    {
        "chapter_title": "Momentum Finds Its Groove",
        "chapter_body": (
            "Week 2 was where the habit began to take shape. The alarm at 6:45am stopped feeling "
            "like punishment and started feeling like a ritual. You completed 20 of 21 tasks — "
            "the single miss was a rest day swap, not an abandonment.\n\n"
            "The 25-minute continuous run on Saturday was a genuine breakthrough. Four weeks ago "
            "you couldn't run for 8 minutes without stopping. The same legs, the same lungs, "
            "but a different relationship with discomfort. You've learned that the first 5 minutes "
            "always lie to you — they say it won't get better. They're wrong every time.\n\n"
            "Your consistency score hit 9 out of 14 days, which unlocked a higher odds tier for "
            "your next reward roll. The system is rewarding what you're already building: "
            "the daily decision to show up."
        ),
        "highlights": [
            "20/21 tasks completed — highest rate so far",
            "First ever 25-minute continuous run completed",
            "Consistency score reached 9/14 days — improved reward odds unlocked",
        ],
        "completed_tasks": 20,
        "completed_days": 6,
        "is_fallback": False,
    },
]

# ---------------------------------------------------------------------------
# Weekly reflection
# ---------------------------------------------------------------------------

DEMO_WEEKLY_REFLECTION = {
    "went_well": (
        "The morning run schedule clicked into place this week. Having a fixed time — "
        "6:45am before anyone else is up — removed all the 'when should I do it' friction. "
        "I also noticed I'm recovering faster between sessions than I did in week one."
    ),
    "blockers": (
        "Wednesday's interval session was harder than expected and I nearly skipped it. "
        "The weather was miserable and my motivation was low. I did a shorter version instead "
        "of nothing, but I want to find a mental strategy for low-motivation mornings."
    ),
    "week_rating": 4,
    "coach_recommendation": (
        "Your adaptation to morning training is impressive — that's one of the hardest habits "
        "to establish. For low-motivation mornings, try the '5-minute rule': commit only to "
        "getting dressed and stepping outside. You'll almost always continue once you're moving. "
        "The body warms up faster than the mind does."
    ),
}

# ---------------------------------------------------------------------------
# Rewards to seed
# ---------------------------------------------------------------------------

DEMO_REWARDS = [
    {"reward_type": "theme", "reward_key": "sunset_ember", "is_equipped": True},
    {"reward_type": "title", "reward_key": "streak_survivor", "is_equipped": False},
    {"reward_type": "lore",  "reward_key": "lore_ember",     "is_equipped": False},
    # Extra rewards for Goal 1 (running) listed here — they'll be linked to the user
    {"reward_type": "title", "reward_key": "comeback_kid",   "is_equipped": False},
    {"reward_type": "lore",  "reward_key": "lore_speck",     "is_equipped": False},
]
