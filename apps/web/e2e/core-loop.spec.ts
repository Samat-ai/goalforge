import { expect, test } from '@playwright/test'

type TaskState = {
  id: string
  goal_id: string
  milestone_id: string | null
  description: string
  tip: string
  assigned_date: string
  position: number
  is_completed: boolean
  completed_at: string | null
  is_rescue_task: boolean
  original_description: string | null
  original_tip: string | null
}

type GoalState = {
  id: string
  user_id: string
  raw_input: string
  smart_title: string
  smart_description: string
  goal_type: string
  target_date: string
  milestones: Array<{
    id: string
    goal_id: string
    title: string
    position: number
    is_final: boolean
    sprint_theme: string
    sprint_status: 'pending' | 'generating' | 'ready' | 'active' | 'completed' | 'failed'
    is_completed: boolean
    completed_at: string | null
    created_at: string
  }>
  milestones_completed: number
  milestones_total: number
  status: 'active' | 'achieved' | 'abandoned'
  progress: number
  created_at: string
  daily_tasks: TaskState[]
  completed_days: string[]
  rescue_mode: boolean
}

function jsonHeaders() {
  return {
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  }
}

function parseBalance(text: string): number {
  const match = text.match(/(\d+)\s*balance/i)
  if (!match) throw new Error(`Could not parse balance from: ${text}`)
  return Number(match[1])
}

// Seed onboarding-complete so OnboardingGuard doesn't redirect /dashboard → /onboarding.
// These tests exercise the core loop, not the first-run wizard.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('goalforge_onboarding_complete', 'true')
      // Solly's suggestion banner is clock-gated (energy fires >= 14:00 local) —
      // snooze both types so post-2pm CI runs don't shift the list-head layout.
      localStorage.setItem('gf_suggest_snooze_energy', String(Date.now()))
      localStorage.setItem('gf_suggest_snooze_focus', String(Date.now()))
    } catch { /* ignore */ }
  })
})

test('core loop: login, create goal, complete 3 tasks, and redeem shop reward', async ({ page }) => {
  const userId = 'user_e2e'
  const today = new Intl.DateTimeFormat('en-CA').format(new Date())
  const createdAt = new Date().toISOString()

  const state: {
    points: number
    goals: GoalState[]
    goalsCallCount: number
    shopRewards: Array<{
      id: string
      user_id: string
      title: string
      cost: number
      is_active: boolean
      redemption_count: number
      created_at: string
    }>
  } = {
    points: 120,
    goals: [],
    goalsCallCount: 0,
    shopRewards: [
      {
        id: 'shop-1',
        user_id: userId,
        title: 'Premium Coffee Break',
        cost: 40,
        is_active: true,
        redemption_count: 0,
        created_at: createdAt,
      },
    ],
  }

  const goalId = 'goal-1'
  const milestoneId = 'mile-1'

  const sprintTasks: TaskState[] = [
    {
      id: 'task-1',
      goal_id: goalId,
      milestone_id: milestoneId,
      description: 'Plan your first sprint session',
      tip: 'Keep it to 15 minutes to build momentum.',
      assigned_date: today,
      position: 0,
      is_completed: false,
      completed_at: null,
      is_rescue_task: false,
      original_description: null,
      original_tip: null,
    },
    {
      id: 'task-2',
      goal_id: goalId,
      milestone_id: milestoneId,
      description: 'Complete one focused implementation block',
      tip: 'Silence notifications before starting.',
      assigned_date: today,
      position: 1,
      is_completed: false,
      completed_at: null,
      is_rescue_task: false,
      original_description: null,
      original_tip: null,
    },
    {
      id: 'task-3',
      goal_id: goalId,
      milestone_id: milestoneId,
      description: 'Write a short reflection and next step',
      tip: 'Capture what worked and what to improve tomorrow.',
      assigned_date: today,
      position: 2,
      is_completed: false,
      completed_at: null,
      is_rescue_task: false,
      original_description: null,
      original_tip: null,
    },
  ]

  // Returns a goal in the initial AI-generating state (no tasks yet — mirrors real 202 response).
  function makeGeneratingGoal(rawInput: string): GoalState {
    return {
      id: goalId,
      user_id: userId,
      raw_input: rawInput,
      smart_title: 'AI-driven Sprint Goal',
      smart_description: 'Generated SMART goal for end-to-end verification.',
      goal_type: 'professional',
      target_date: '2026-12-31',
      milestones: [
        {
          id: milestoneId,
          goal_id: goalId,
          title: 'Sprint 1',
          position: 0,
          is_final: false,
          sprint_theme: 'Foundation',
          sprint_status: 'generating',
          is_completed: false,
          completed_at: null,
          created_at: createdAt,
        },
      ],
      milestones_completed: 0,
      milestones_total: 1,
      status: 'active',
      progress: 0,
      created_at: createdAt,
      daily_tasks: [],
      completed_days: [],
      rescue_mode: false,
    }
  }

  // Returns the same goal after AI generation completes (sprint active, tasks populated).
  function makeActiveGoal(rawInput: string): GoalState {
    return {
      ...makeGeneratingGoal(rawInput),
      milestones: [
        {
          id: milestoneId,
          goal_id: goalId,
          title: 'Sprint 1',
          position: 0,
          is_final: false,
          sprint_theme: 'Foundation',
          sprint_status: 'active',
          is_completed: false,
          completed_at: null,
          created_at: createdAt,
        },
      ],
      daily_tasks: sprintTasks,
    }
  }

  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname, searchParams } = url
    const method = request.method()

    // Only mock backend API requests.
    if (url.port !== '8000') {
      await route.continue()
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/profile`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ star_points: state.points }) })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/goals`) {
      const limit = Number(searchParams.get('limit') ?? '20')
      const offset = Number(searchParams.get('offset') ?? '0')

      // Simulate the async AI generation lifecycle:
      // - First two GETs (invalidateQueries + possible mount refetch) return generating state.
      // - Third GET onwards (the 5 s refetchInterval from needsPolling) transitions to active.
      // Threshold is 3 instead of 2 to absorb any rapid-fire duplicate queries React Query
      // may fire on CI under load, ensuring `generating…` is always visible before transition.
      if (state.goals.length > 0) {
        state.goalsCallCount++
        if (state.goalsCallCount >= 3 && state.goals[0].milestones[0].sprint_status === 'generating') {
          state.goals = [makeActiveGoal(state.goals[0].raw_input)]
        }
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          items: state.goals,
          total: state.goals.length,
          limit,
          offset,
        }),
      })
      return
    }

    if (method === 'POST' && pathname === `/users/${userId}/goals`) {
      const payload = request.postDataJSON() as { raw_input?: string }
      const goal = makeGeneratingGoal(payload.raw_input ?? 'Untitled')
      state.goals = [goal]
      state.goalsCallCount = 0
      // Real API returns 202 Accepted; generation happens in background.
      await route.fulfill({ status: 202, headers: jsonHeaders(), body: JSON.stringify(goal) })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/badges`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/rewards`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/shop-rewards`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(state.shopRewards) })
      return
    }

    if (method === 'POST' && /^\/shop-rewards\/.+\/redeem$/.test(pathname)) {
      const rewardId = pathname.split('/')[2]
      const reward = state.shopRewards.find(r => r.id === rewardId)
      if (!reward || !reward.is_active || state.points < reward.cost) {
        await route.fulfill({ status: 400, headers: jsonHeaders(), body: JSON.stringify({ detail: 'Cannot redeem reward' }) })
        return
      }

      state.points -= reward.cost
      reward.redemption_count += 1

      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ reward, remaining_star_points: state.points }),
      })
      return
    }

    if (method === 'PATCH' && /^\/tasks\/.+\/complete$/.test(pathname)) {
      const taskId = pathname.split('/')[2]
      const goal = state.goals[0]
      const task = goal?.daily_tasks.find(t => t.id === taskId)
      if (!goal || !task) {
        await route.fulfill({ status: 404, headers: jsonHeaders(), body: JSON.stringify({ detail: 'Task not found' }) })
        return
      }

      task.is_completed = true
      task.completed_at = createdAt
      if (!goal.completed_days.includes(today)) {
        goal.completed_days.push(today)
      }
      state.points += 10

      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ ...task, points_awarded: 10, reward_drop: null }) })
      return
    }

    await route.fulfill({ status: 500, headers: jsonHeaders(), body: JSON.stringify({ detail: `Unhandled mock route: ${method} ${pathname}` }) })
  })

  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  const goalInput = page.getByLabel(/describe your goal/i)
  await goalInput.click()
  await goalInput.pressSequentially('Ship phase 3 pipeline')
  await expect(goalInput).toHaveValue('Ship phase 3 pipeline')
  await page.getByRole('button', { name: /create goal/i }).click()

  // Goal title appears immediately from the optimistic cache update on the 202 response.
  await expect(page.getByText('AI-driven Sprint Goal')).toBeVisible()

  // GoalCard shows the generating spinner while the background task runs.
  await expect(page.getByText('generating…')).toBeVisible()

  // Tasks only appear after the polling cycle detects sprint_status: active.
  // The goals query polls every 5 s when needsPolling() is true — allow two cycles.
  await expect(page.getByLabel('Mark task complete').first()).toBeVisible({ timeout: 15_000 })

  for (let i = 0; i < 3; i += 1) {
    await page.getByLabel('Mark task complete').first().click()
    // After the optimistic update the completed button's aria-label flips to 'Task completed',
    // removing it from this locator's match set. Waiting for the count to drop by 1 proves
    // the click registered and React re-rendered before we attempt the next click.
    await expect(page.getByLabel('Mark task complete')).toHaveCount(2 - i)
  }

  // StarShop moved off the Dashboard to the Logs (/stars) page in #101 (dashboard declutter).
  await page.getByRole('link', { name: 'Logs' }).first().click()
  await expect(page).toHaveURL(/\/stars$/)

  await expect(page.getByText('150 balance')).toBeVisible()
  const beforeRedeem = parseBalance(await page.getByText(/\d+\s*balance/).first().innerText())

  await page.getByRole('button', { name: 'Redeem' }).click()

  await expect.poll(async () => {
    const text = await page.getByText(/\d+\s*balance/).first().innerText()
    return parseBalance(text)
  }).toBeLessThan(beforeRedeem)

  await expect(page.getByText('110 balance')).toBeVisible()

  // Verify the shop card's redemption counter incremented — confirms the server-side
  // deduction was acknowledged and the UI reflects the updated redemption_count.
  await expect(page.getByText('redeemed 1×')).toBeVisible()
})

test('offline banner appears when network is lost and disappears when restored', async ({ page, context }) => {
  const userId = 'user_e2e'

  // Set up minimal API mocks so the dashboard can render without errors.
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname, searchParams } = url
    const method = request.method()

    if (url.port !== '8000') {
      await route.continue()
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/profile`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ star_points: 0 }) })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/goals`) {
      const limit = Number(searchParams.get('limit') ?? '20')
      const offset = Number(searchParams.get('offset') ?? '0')
      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ items: [], total: 0, limit, offset }),
      })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/badges`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/rewards`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }

    if (method === 'GET' && pathname === `/users/${userId}/shop-rewards`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }

    await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({}) })
  })

  // Navigate to dashboard — OfflineBanner is mounted at the App level (outside Routes)
  // so it renders on every page regardless of route.
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // The banner div is only mounted when offline — it must not exist while online.
  await expect(page.getByRole('status')).not.toBeAttached()

  // Simulate going offline — Playwright fires the window 'offline' event via CDP.
  await context.setOffline(true)

  // Banner should slide up and show the offline message.
  await expect(page.getByRole('status')).toBeVisible()
  await expect(page.getByRole('status'))
    .toContainText('You are offline. Live syncing is paused.')

  // Restore network — Playwright fires the window 'online' event.
  await context.setOffline(false)

  // Banner should disappear (component returns null when online).
  await expect(page.getByRole('status')).not.toBeAttached()
})
