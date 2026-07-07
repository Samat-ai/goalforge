// gf-data.jsx — mock data + derived analytics for the GoalForge redesign prototype.
// Faithful to the real data model (goals, daily_tasks, milestones, profile, badges).

(function () {
  const fmt = (d) => new Intl.DateTimeFormat('en-CA').format(d);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const todayStr = fmt(today);
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };

  function seeded(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
  const rnd = seeded(42);

  // build completed_days: a current streak ending today + sparse history before
  function buildDays(streakLen, density, span = 70) {
    const out = [];
    for (let i = 0; i < streakLen; i++) out.push(daysAgo(i));
    for (let i = streakLen + 1; i < span; i++) { if (rnd() < density) out.push(daysAgo(i)); }
    return out;
  }

  // ── Stages ───────────────────────────────────────────────────────────────────
  const STAGES = [
    { id: 0, name: 'Speck',     pts: 0,   desc: 'A tiny spark of intention.' },
    { id: 1, name: 'Ember',     pts: 30,  desc: 'Warming up. Something stirs.' },
    { id: 2, name: 'Flare',     pts: 80,  desc: 'Bright and growing. Momentum is building.' },
    { id: 3, name: 'Luminary',  pts: 175, desc: 'Radiating light. Your consistency is showing.' },
    { id: 4, name: 'Nova',      pts: 350, desc: 'A brilliant burst. You\u2019re unstoppable.' },
    { id: 5, name: 'Celestial', pts: 600, desc: 'Transcendent. Pure stellar energy.' },
  ];
  const getStage = (p) => { for (let i = STAGES.length - 1; i >= 0; i--) if (p >= STAGES[i].pts) return STAGES[i]; return STAGES[0]; };
  const getNext = (p) => STAGES.find(s => s.pts > p) ?? null;

  const profile = { name: 'Alex', pts: 212, energy: 'steady' };
  const stage = getStage(profile.pts);
  const next = getNext(profile.pts);
  const stagePct = next ? (profile.pts - stage.pts) / (next.pts - stage.pts) : 1;

  // ── Goals (active) ───────────────────────────────────────────────────────────
  const goals = [
    {
      id: 'g1', smart_title: 'Run a half-marathon by October', goal_type: 'fitness',
      smart_description: 'Build an aerobic base and progressively extend long runs to 21km while staying injury-free.',
      raw_input: 'i want to run a half marathon', status: 'active', progress: 64, streak: 12, brightness: 0.92,
      deadline: '112d left', deadlineKind: 'ok',
      tasks: [
        { id: 't1', title: '5km easy zone-2 run', done: true },
        { id: 't2', title: 'Mobility & hips \u2014 10 min', done: false },
        { id: 't3', title: 'Foam roll + stretch', done: false },
      ],
      overdue: [],
      milestones: [
        { pos: 1, title: 'Build the base \u2014 20km / week', status: 'completed' },
        { pos: 2, title: 'Add tempo runs', status: 'completed' },
        { pos: 3, title: 'Long-run progression to 18km', status: 'active' },
        { pos: 4, title: 'Race taper & peak', status: 'upcoming' },
      ],
      completed_days: buildDays(12, 0.55),
    },
    {
      id: 'g2', smart_title: 'Ship the GoalForge v2 launch', goal_type: 'career',
      smart_description: 'Polish the beta, record the demo, and publish the launch thread to ship v2 to the public.',
      raw_input: 'launch the new version', status: 'active', progress: 41, streak: 5, brightness: 0.7,
      deadline: '9d left', deadlineKind: 'soon',
      tasks: [
        { id: 't4', title: 'Write launch announcement', done: true },
        { id: 't5', title: 'Record 60s product demo', done: false },
      ],
      overdue: [{ id: 't5b', title: 'Finalize pricing page copy', done: false }],
      milestones: [
        { pos: 1, title: 'Spec & scope locked', status: 'completed' },
        { pos: 2, title: 'Beta polish sprint', status: 'active' },
        { pos: 3, title: 'Demo & launch assets', status: 'upcoming' },
        { pos: 4, title: 'Public launch', status: 'upcoming' },
      ],
      completed_days: buildDays(5, 0.45),
    },
    {
      id: 'g3', smart_title: 'Read 12 books this year', goal_type: 'learning',
      smart_description: 'One book every ~3 weeks. Currently 9 of 12 finished and on pace for the year.',
      raw_input: 'read more books', status: 'active', progress: 75, streak: 3, brightness: 0.6,
      deadline: '201d left', deadlineKind: 'ok',
      tasks: [
        { id: 't6', title: 'Read 20 pages', done: false },
      ],
      overdue: [],
      milestones: [
        { pos: 1, title: 'Books 1\u20133', status: 'completed' },
        { pos: 2, title: 'Books 4\u20136', status: 'completed' },
        { pos: 3, title: 'Books 7\u20139', status: 'completed' },
        { pos: 4, title: 'Books 10\u201312', status: 'active' },
      ],
      completed_days: buildDays(3, 0.5),
    },
    {
      id: 'g4', smart_title: 'Learn conversational Spanish', goal_type: 'learning',
      smart_description: 'Daily practice toward holding a 5-minute conversation by spring.',
      raw_input: 'learn spanish', status: 'active', progress: 28, streak: 0, brightness: 0.22, lastStreak: 6,
      deadline: 'overdue', deadlineKind: 'over',
      tasks: [
        { id: 't7', title: 'Daily lesson \u2014 15 min', done: false },
        { id: 't8', title: 'Review 10 new words', done: false },
      ],
      overdue: [{ id: 't7b', title: 'Catch up: Unit 3 listening', done: false }],
      milestones: [
        { pos: 1, title: 'Alphabet & greetings', status: 'completed' },
        { pos: 2, title: 'Present tense fluency', status: 'active' },
        { pos: 3, title: 'Past & future tenses', status: 'upcoming' },
        { pos: 4, title: 'Hold a 5-min conversation', status: 'upcoming' },
      ],
      completed_days: buildDays(0, 0.3),
    },
  ];

  const achieved = [
    { id: 'a1', smart_title: 'Meditate 30 days straight', goal_type: 'wellness', progress: 100, brightness: 1,
      smart_description: 'A full month of unbroken morning sits.', raw_input: 'meditate every day', streak: 31, days: 31,
      milestones: [{ pos:1,title:'Week 1',status:'completed'},{pos:2,title:'Week 2',status:'completed'},{pos:3,title:'Week 3',status:'completed'},{pos:4,title:'Week 4',status:'completed'}],
      tasks: [], overdue: [], completed_days: buildDays(31, 0.2), deadline: 'done', deadlineKind: 'ok', status: 'achieved' },
    { id: 'a2', smart_title: 'Launch my personal site', goal_type: 'career', progress: 100, brightness: 1,
      smart_description: 'Designed, built and shipped a portfolio in three weeks.', raw_input: 'build a portfolio site', streak: 0, days: 21,
      milestones: [{ pos:1,title:'Design',status:'completed'},{pos:2,title:'Build',status:'completed'},{pos:3,title:'Ship',status:'completed'}],
      tasks: [], overdue: [], completed_days: buildDays(0, 0.25, 30), deadline: 'done', deadlineKind: 'ok', status: 'achieved' },
  ];

  const badges = [
    { key: 'first_step', title: 'First Step',     description: 'Complete your first task',        current: 1,  target: 1,  unlocked: true },
    { key: 'week_warrior', title: 'Week Warrior',  description: 'Hit a 7-day streak',              current: 12, target: 7,  unlocked: true },
    { key: 'centurion', title: 'Centurion',        description: 'Complete 100 tasks',              current: 100, target: 100, unlocked: true },
    { key: 'goal_getter', title: 'Goal Getter',    description: 'Achieve 3 goals',                 current: 2,  target: 3,  unlocked: false },
    { key: 'night_owl', title: 'Night Owl',        description: 'Complete 20 evening tasks',       current: 14, target: 20, unlocked: false },
    { key: 'unstoppable', title: 'Unstoppable',    description: 'Reach a 30-day streak',           current: 12, target: 30, unlocked: false },
  ];

  // ── Derived analytics ─────────────────────────────────────────────────────────
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const velocity = [];
  const velCounts = [4, 2, 5, 3, 6, 1, 4];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    velocity.push({ label: dayNames[d.getDay()], count: velCounts[6 - i], date: fmt(d) });
  }

  const WEEKS = 18;
  const heatmap = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabels = [];
  const todayDow = today.getDay();
  const startSunday = new Date(today);
  startSunday.setDate(today.getDate() + (6 - todayDow) - (WEEKS * 7 - 1));
  const cursor = new Date(startSunday);
  let prevMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let dow = 0; dow < 7; dow++) {
      const ds = fmt(cursor);
      const future = ds > todayStr;
      let count = 0;
      if (!future) { const r = rnd(); count = r < 0.34 ? 0 : r < 0.6 ? 1 : r < 0.82 ? 2 : r < 0.94 ? 4 : 6; }
      week.push({ date: ds, count: future ? -1 : count, dow });
      if (dow === 0 && cursor.getMonth() !== prevMonth) { monthLabels.push({ col: w, label: monthNames[cursor.getMonth()] }); prevMonth = cursor.getMonth(); }
      cursor.setDate(cursor.getDate() + 1);
    }
    heatmap.push(week);
  }

  const timeOfDay = [
    { name: 'Morning', value: 38 }, { name: 'Afternoon', value: 21 },
    { name: 'Evening', value: 29 }, { name: 'Night', value: 8 },
  ];

  const stats = {
    activeGoals: goals.length, tasksCompleted: 247, starPoints: profile.pts,
    currentStreak: 12, personalBest: 31, thisWeek: 25, lastWeek: 19, consistency: 0.86,
  };

  // ── Star economy ───────────────────────────────────────────────────────────────
  const starLog = {
    is_fallback: false,
    chapter_title: 'The Long-Run Ascent',
    chapter_body: 'This week your half-marathon training found its rhythm \u2014 twelve days unbroken, each dawn run banking light into your star. The launch sprint flickered, but momentum holds. You are becoming the kind of person who finishes what they start.',
    highlights: ['12-day streak', 'Half-marathon base done', '25 tasks this week'],
    completed_tasks: 25,
    completed_days: 6,
  };

  const shopRewards = [
    { id: 'r1', title: 'Specialty coffee & a pastry', cost: 60, redemption_count: 4, is_active: true },
    { id: 'r2', title: 'Guilt-free movie night', cost: 120, redemption_count: 2, is_active: true },
    { id: 'r3', title: 'New running shoes fund', cost: 400, redemption_count: 0, is_active: true },
    { id: 'r4', title: 'Weekend trip splurge', cost: 800, redemption_count: 0, is_active: true },
  ];

  const settings = {
    display_name: 'Alex',
    timezone: 'America/Toronto',
    reminder_enabled: true,
    reminder_hour: 8,
    push_active: 1,
  };

  window.GF_DATA = {
    todayStr, daysAgo, fmt, dayNames, monthNames,
    STAGES, getStage, getNext, profile, stage, next, stagePct,
    goals, achieved, badges,
    velocity, heatmap, monthLabels, timeOfDay, stats,
    starLog, shopRewards, settings,
    greeting: (() => { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })(),
    todayLabel: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
})();
