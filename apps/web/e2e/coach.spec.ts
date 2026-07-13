import { expect, test, type Page } from '@playwright/test'

// ─── Coach v2 E2E — session rail, mobile drawer, hero empty state, thread lifecycle ───
//
// All backend traffic is mock-routed (no real API). Patterns follow core-loop.spec.ts:
// the Playwright webServer bakes VITE_API_BASE_URL=http://127.0.0.1:8000, so every
// axios request targets port 8000 — everything else (Vite assets) continues untouched.
//
// Determinism: reduced motion is emulated in beforeEach. ChatPage's word-reveal stream
// is skipped entirely under prefers-reduced-motion (beginReveal early-return), so coach
// replies commit instantly once the POST resolves — no 48ms/word timing to await.
//
// Mutation call counts (POST/DELETE) are asserted exactly: mutations fire once per user
// action, unlike GET queries which React Query may duplicate (the core-loop ">= 3"
// threshold gotcha) — so no GET-count assertions appear anywhere in this file.

const USER_ID = 'user_e2e'
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

// 54 chars: longer than the 42-char rail truncation, shorter than the 80-char
// server-side preview cut — exercises exactly one truncation layer.
const PREVIEW_LONG = 'help me build a consistent morning routine that sticks'
// fallbackTitle(): slice(0, 42).trim() + '…'
const PREVIEW_TRUNCATED = 'help me build a consistent morning routine…'

type CoachMessageState = {
  id: string
  session_id: string
  role: 'coach' | 'user'
  content: string
  chips: string[] | null
  forged_goal_id: string | null
  created_at: string
}

type CoachSessionState = {
  id: string
  user_id: string
  title: string | null
  is_completed: boolean
  created_at: string
  updated_at: string
  messages: CoachMessageState[]
}

function jsonHeaders() {
  return {
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  }
}

// Full Goal shape (src/lib/types.ts) so the plan card hydrates AND the Dashboard
// can render it crash-free after the plan-card link navigation in spec 6.
const FORGED_GOAL_ID = 'goal-forged-1'
const FORGED_GOAL = {
  id: FORGED_GOAL_ID,
  user_id: USER_ID,
  raw_input: 'I want to train for a marathon',
  smart_title: 'Run a 10K in 12 weeks',
  smart_description: 'Build from brisk walks to a continuous 10K with three runs per week.',
  goal_type: 'personal',
  target_date: '2026-12-31',
  milestones: [
    {
      id: 'mile-f1',
      goal_id: FORGED_GOAL_ID,
      title: 'Base mileage',
      position: 0,
      is_final: false,
      sprint_theme: 'Foundation',
      sprint_status: 'active',
      is_completed: false,
      completed_at: null,
      created_at: '2026-07-01T10:00:00.000Z',
    },
    {
      id: 'mile-f2',
      goal_id: FORGED_GOAL_ID,
      title: 'First 5K without stopping',
      position: 1,
      is_final: false,
      sprint_theme: 'Endurance',
      sprint_status: 'pending',
      is_completed: false,
      completed_at: null,
      created_at: '2026-07-01T10:00:00.000Z',
    },
  ],
  milestones_completed: 0,
  milestones_total: 2,
  status: 'active',
  progress: 0,
  created_at: '2026-07-01T10:00:00.000Z',
  daily_tasks: [
    {
      id: 'task-f1',
      goal_id: FORGED_GOAL_ID,
      milestone_id: 'mile-f1',
      description: 'Walk briskly for 20 minutes',
      tip: 'Pick a route you enjoy.',
      assigned_date: '2026-07-12',
      position: 0,
      is_completed: false,
      completed_at: null,
      is_rescue_task: false,
      is_user_added: false,
      original_description: null,
      original_tip: null,
    },
    {
      id: 'task-f2',
      goal_id: FORGED_GOAL_ID,
      milestone_id: 'mile-f1',
      description: 'Stretch for 10 minutes after the walk',
      tip: 'Focus on calves and hamstrings.',
      assigned_date: '2026-07-12',
      position: 1,
      is_completed: false,
      completed_at: null,
      is_rescue_task: false,
      is_user_added: false,
      original_description: null,
      original_tip: null,
    },
  ],
  completed_days: [],
  rescue_mode: false,
}

// Three sessions spanning three rail buckets (bucketOf: <1d Today, <2d Yesterday,
// <7d Previous 7 days). The Yesterday one has title: null + a user message whose
// content becomes the list `preview` → exercises the italic fallback title path.
// The last coach message of the Today session carries BOTH chips and a
// forged_goal_id, feeding the chip-row spec and the plan-card hydration spec.
function buildCoachState() {
  const now = Date.now()
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

  const today: CoachSessionState = {
    id: 's-today',
    user_id: USER_ID,
    title: 'Marathon training plan',
    is_completed: false,
    created_at: iso(3 * HOUR_MS),
    updated_at: iso(2 * HOUR_MS),
    messages: [
      {
        id: 's-today-m1',
        session_id: 's-today',
        role: 'coach',
        content: 'Marathon intake — where are you starting from?',
        chips: null,
        forged_goal_id: null,
        created_at: iso(3 * HOUR_MS),
      },
      {
        id: 's-today-m2',
        session_id: 's-today',
        role: 'user',
        content: 'I want to train for a marathon',
        chips: null,
        forged_goal_id: null,
        created_at: iso(2.5 * HOUR_MS),
      },
      {
        id: 's-today-m3',
        session_id: 's-today',
        role: 'coach',
        content: '*Plan forged.* Here it is — tweak anything you like.',
        chips: ['Adjust the plan', 'Make it stretchier'],
        forged_goal_id: FORGED_GOAL_ID,
        created_at: iso(2 * HOUR_MS),
      },
    ],
  }

  const yesterday: CoachSessionState = {
    id: 's-yesterday',
    user_id: USER_ID,
    title: null,
    is_completed: false,
    created_at: iso(27 * HOUR_MS),
    updated_at: iso(26 * HOUR_MS),
    messages: [
      {
        id: 's-yesterday-m1',
        session_id: 's-yesterday',
        role: 'coach',
        content: 'Yesterday thread marker — morning routine intake.',
        chips: null,
        forged_goal_id: null,
        created_at: iso(27 * HOUR_MS),
      },
      {
        id: 's-yesterday-m2',
        session_id: 's-yesterday',
        role: 'user',
        content: PREVIEW_LONG,
        chips: null,
        forged_goal_id: null,
        created_at: iso(26 * HOUR_MS),
      },
    ],
  }

  const older: CoachSessionState = {
    id: 's-older',
    user_id: USER_ID,
    title: 'Reading habit sprint',
    is_completed: false,
    created_at: iso(4 * DAY_MS),
    updated_at: iso(4 * DAY_MS),
    messages: [
      {
        id: 's-older-m1',
        session_id: 's-older',
        role: 'coach',
        content: 'Older thread marker — reading habit.',
        chips: null,
        forged_goal_id: null,
        created_at: iso(4 * DAY_MS),
      },
    ],
  }

  return {
    // ordered newest-first, mirroring the backend's updated_at DESC ordering
    sessions: [today, yesterday, older] as CoachSessionState[],
    counts: { createSession: 0, sendMessage: 0, deleteSession: 0 },
    // consumed by the send handler: each unit makes one POST /messages fail with 500
    failNextSends: 0,
  }
}
type CoachMockState = ReturnType<typeof buildCoachState>

function makeGreetingSession(n: number): CoachSessionState {
  const nowIso = new Date().toISOString()
  const id = `s-new-${n}`
  return {
    id,
    user_id: USER_ID,
    title: null,
    is_completed: false,
    created_at: nowIso,
    updated_at: nowIso,
    messages: [
      {
        id: `${id}-m1`,
        session_id: id,
        role: 'coach',
        content: "Hey! I'm Solly. What goal should we forge together?",
        chips: null,
        forged_goal_id: null,
        created_at: nowIso,
      },
    ],
  }
}

async function installCoachMocks(page: Page, state: CoachMockState) {
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

    // Permissive CORS preflight, in case the browser sends one for the mocked
    // verbs (the axios instance adds an X-User-Timezone header to every call).
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
      return
    }

    if (method === 'GET' && pathname === `/users/${USER_ID}/coach/sessions`) {
      // List items carry `preview` = first user-role message, server-truncated
      // to 80 chars (apps/api/routes/coach.py), or null for greeting-only threads.
      const items = state.sessions.map(s => ({
        id: s.id,
        title: s.title,
        preview: s.messages.find(m => m.role === 'user')?.content.slice(0, 80) ?? null,
        updated_at: s.updated_at,
      }))
      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ items, total: items.length, limit: 50, offset: 0 }),
      })
      return
    }

    if (method === 'POST' && pathname === `/users/${USER_ID}/coach/sessions`) {
      state.counts.createSession += 1
      const created = makeGreetingSession(state.counts.createSession)
      state.sessions.unshift(created)
      await route.fulfill({ status: 201, headers: jsonHeaders(), body: JSON.stringify(created) })
      return
    }

    const sendMatch = pathname.match(/^\/coach\/sessions\/([^/]+)\/messages$/)
    if (method === 'POST' && sendMatch) {
      state.counts.sendMessage += 1
      if (state.failNextSends > 0) {
        state.failNextSends -= 1
        await route.fulfill({ status: 500, headers: jsonHeaders(), body: JSON.stringify({ detail: 'Forge unavailable' }) })
        return
      }
      const sess = state.sessions.find(s => s.id === sendMatch[1])
      if (!sess) {
        await route.fulfill({ status: 404, headers: jsonHeaders(), body: JSON.stringify({ detail: 'Session not found' }) })
        return
      }
      const payload = request.postDataJSON() as { content?: string }
      const content = payload.content ?? ''
      const stamp = new Date().toISOString()
      const n = state.counts.sendMessage
      sess.messages.push(
        {
          id: `m-user-${n}`,
          session_id: sess.id,
          role: 'user',
          content,
          chips: null,
          forged_goal_id: null,
          created_at: stamp,
        },
        {
          id: `m-coach-${n}`,
          session_id: sess.id,
          role: 'coach',
          content: `You said: ${content}`,
          chips: ['Tell me more', 'Make it a goal'],
          forged_goal_id: null,
          created_at: stamp,
        },
      )
      sess.updated_at = stamp
      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ session: sess, forged_goal: null }),
      })
      return
    }

    const sessMatch = pathname.match(/^\/coach\/sessions\/([^/]+)$/)
    if (sessMatch) {
      if (method === 'GET') {
        const sess = state.sessions.find(s => s.id === sessMatch[1])
        if (sess) {
          await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(sess) })
        } else {
          await route.fulfill({ status: 404, headers: jsonHeaders(), body: JSON.stringify({ detail: 'Session not found' }) })
        }
        return
      }
      if (method === 'DELETE') {
        state.counts.deleteSession += 1
        state.sessions = state.sessions.filter(s => s.id !== sessMatch[1])
        await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
        return
      }
    }

    // Plan-card hydration source (useAllGoalsQuery, limit=100) — the same handler
    // also serves the Dashboard's limit=20 list after the spec-6 navigation.
    if (method === 'GET' && pathname === `/users/${USER_ID}/goals`) {
      const limit = Number(searchParams.get('limit') ?? '20')
      const offset = Number(searchParams.get('offset') ?? '0')
      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ items: [FORGED_GOAL], total: 1, limit, offset }),
      })
      return
    }

    // AppShell / Dashboard chrome queries — harmless defaults.
    if (method === 'GET' && pathname === `/users/${USER_ID}/profile`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ star_points: 0, display_name: null }) })
      return
    }
    if (method === 'GET' && pathname === `/users/${USER_ID}/badges`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }
    if (method === 'GET' && pathname === `/users/${USER_ID}/rewards`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }
    if (method === 'GET' && pathname === `/users/${USER_ID}/shop-rewards`) {
      await route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify([]) })
      return
    }

    await route.fulfill({ status: 500, headers: jsonHeaders(), body: JSON.stringify({ detail: `Unhandled mock route: ${method} ${pathname}` }) })
  })
}

// Seed onboarding-complete (OnboardingGuard would bounce /coach → /onboarding) and
// force reduced motion so word-reveal streaming never runs (see file header).
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    try { localStorage.setItem('goalforge_onboarding_complete', 'true') } catch { /* ignore */ }
  })
})

test('rail renders time buckets and rows; null-title row shows the italic preview fallback', async ({ page }) => {
  const state = buildCoachState()
  await installCoachMocks(page, state)
  await page.goto('/coach')

  // Bucket headers in BUCKET_ORDER; array form pins count + order + text at once.
  await expect(page.locator('.gf-co-rail-cap')).toHaveText(['Today', 'Yesterday', 'Previous 7 days'])
  await expect(page.locator('.gf-co-rail-item')).toHaveCount(3)
  await expect(page.locator('.gf-co-rail-title')).toHaveText([
    'Marathon training plan',
    PREVIEW_TRUNCATED,
    'Reading habit sprint',
  ])

  // The title-less session renders its truncated preview with the fallback class,
  // which the CSS styles italic.
  const fallbackTitle = page.locator('.gf-co-rail-title.is-fallback')
  await expect(fallbackTitle).toHaveCount(1)
  await expect(fallbackTitle).toHaveText(PREVIEW_TRUNCATED)
  await expect(fallbackTitle).toHaveCSS('font-style', 'italic')
})

test('selecting a rail session loads that thread', async ({ page }) => {
  const state = buildCoachState()
  await installCoachMocks(page, state)
  await page.goto('/coach')

  // Most recent session (s-today) auto-selects — wait for its thread first.
  await expect(page.getByText('I want to train for a marathon')).toBeVisible()

  await page.locator('.gf-co-rail-main', { hasText: 'morning routine' }).click()

  // Distinct mock content proves the yesterday thread replaced the marathon one.
  await expect(page.getByText('Yesterday thread marker — morning routine intake.')).toBeVisible()
  await expect(page.locator('.gf-co-userbub')).toHaveText([PREVIEW_LONG])
  await expect(page.getByText('I want to train for a marathon')).not.toBeVisible()

  // Header title falls back to the truncated preview (same fallback pipeline).
  await expect(page.locator('.gf-co-head-title')).toHaveText(PREVIEW_TRUNCATED)
  await expect(page.locator('.gf-co-head-title')).toHaveClass(/is-fallback/)
})

test('new chat shows the hero empty state; a starter pill fills the draft without sending', async ({ page }) => {
  const state = buildCoachState()
  await installCoachMocks(page, state)
  await page.goto('/coach')

  await page.getByRole('button', { name: 'New chat' }).click()

  await expect(page.locator('.gf-co-empty')).toBeVisible()
  await expect(page.getByRole('heading', { name: "Let's forge your next goal" })).toBeVisible()
  // The hero owns the ONLY composer — no floating bottom composer in the empty state.
  await expect(page.locator('.gf-co-composer.is-hero')).toHaveCount(1)
  await expect(page.locator('.gf-co-composer:not(.is-hero)')).toHaveCount(0)
  await expect(page.locator('.gf-co-starter')).toHaveCount(4)

  await page.getByRole('button', { name: 'Build a reading habit' }).click()

  // Pill FILLS the textarea — it must not auto-send (no session create, no message POST).
  await expect(page.getByLabel('Message Solly')).toHaveValue('Build a reading habit')
  expect(state.counts.createSession).toBe(0)
  expect(state.counts.sendMessage).toBe(0)
})

test('sending from the hero creates a session, then renders the thread', async ({ page }) => {
  const state = buildCoachState()
  await installCoachMocks(page, state)
  await page.goto('/coach')

  await page.getByRole('button', { name: 'New chat' }).click()
  await page.getByLabel('Message Solly').fill('I want to run a marathon')
  await page.getByRole('button', { name: 'Send message' }).click()

  // Lazy create (POST sessions) → send (POST messages): greeting + user bubble +
  // echo reply all visible. Reduced motion commits the reply instantly.
  await expect(page.getByText("Hey! I'm Solly. What goal should we forge together?")).toBeVisible()
  await expect(page.locator('.gf-co-userbub')).toHaveText(['I want to run a marathon'])
  await expect(page.getByText('You said: I want to run a marathon')).toBeVisible()

  expect(state.counts.createSession).toBe(1)
  expect(state.counts.sendMessage).toBe(1)

  // Hero is gone; the floating bottom composer owns the thread view now.
  await expect(page.locator('.gf-co-empty')).toHaveCount(0)
  await expect(page.locator('.gf-co-composer:not(.is-hero)')).toHaveCount(1)
})

test('chips from the last coach message fill the draft without sending', async ({ page }) => {
  const state = buildCoachState()
  await installCoachMocks(page, state)
  await page.goto('/coach')

  // s-today auto-selects; its last coach message carries two chips, rendered
  // inside the composer above the input bar.
  const chips = page.locator('.gf-co-chip')
  await expect(chips).toHaveCount(2)
  await expect(chips).toHaveText(['Adjust the plan', 'Make it stretchier'])

  await chips.first().click()

  await expect(page.getByLabel('Message Solly')).toHaveValue('Adjust the plan')
  expect(state.counts.sendMessage).toBe(0)
})

test('plan card hydrates from the goals list and its kbd button navigates to the dashboard', async ({ page }) => {
  const state = buildCoachState()
  await installCoachMocks(page, state)
  await page.goto('/coach')

  // The forged_goal_id message hydrates the card from GET /goals — the title
  // exists ONLY in the goals mock, never in any message content.
  await expect(page.locator('.gf-co-plan')).toBeVisible()
  await expect(page.locator('.gf-co-plan-title')).toHaveText('Run a 10K in 12 weeks')
  await expect(page.locator('.gf-co-plan').getByText('Base mileage')).toBeVisible()

  await page.getByRole('link', { name: 'Open Dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('delete flow: inline confirm fires DELETE; deleting the active session falls back to the next one', async ({ page }) => {
  const state = buildCoachState()
  await installCoachMocks(page, state)
  await page.goto('/coach')

  // Active thread = s-today.
  await expect(page.getByText('I want to train for a marathon')).toBeVisible()
  await expect(page.locator('.gf-co-rail-item')).toHaveCount(3)

  // Trash is hover-revealed (opacity), then swaps the row into the inline confirm.
  await page.locator('.gf-co-rail-item').first().hover()
  await page.getByRole('button', { name: 'Delete chat: Marathon training plan' }).click()
  await expect(page.getByText('Delete this chat?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm delete' }).click()

  await expect.poll(() => state.counts.deleteSession).toBe(1)

  // Deleting the ACTIVE session falls back to the first remaining session's thread.
  await expect(page.getByText('Yesterday thread marker — morning routine intake.')).toBeVisible()
  await expect(page.locator('.gf-co-rail-item')).toHaveCount(2)
  await expect(page.getByText('Marathon training plan')).toHaveCount(0)
})

test('failed send shows the error row; Retry re-sends the same content', async ({ page }) => {
  const state = buildCoachState()
  state.failNextSends = 1 // first POST /messages → 500, second → 200
  await installCoachMocks(page, state)
  await page.goto('/coach')

  await expect(page.getByText('I want to train for a marathon')).toBeVisible()
  await page.getByLabel('Message Solly').fill('fail me')
  await page.getByRole('button', { name: 'Send message' }).click()

  const errorRow = page.locator('.gf-co-error')
  await expect(errorRow).toBeVisible()
  await expect(errorRow).toContainText('Something went wrong. Try again.')
  expect(state.counts.sendMessage).toBe(1)
  // The optimistic user bubble was rolled back — only the seeded user message remains.
  await expect(page.locator('.gf-co-userbub')).toHaveCount(1)

  await page.getByRole('button', { name: 'Retry' }).click()

  // Retry re-sends the stored content as a new request; on success the turn commits.
  await expect(page.getByText('You said: fail me')).toBeVisible()
  await expect(page.locator('.gf-co-userbub')).toHaveCount(2)
  await expect(errorRow).toHaveCount(0)
  expect(state.counts.sendMessage).toBe(2)
})

test.describe('mobile (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('drawer button opens the session drawer; Escape closes it', async ({ page }) => {
    const state = buildCoachState()
    await installCoachMocks(page, state)
    await page.goto('/coach')

    // Desktop rail is hidden at this width; the header shows the drawer trigger.
    const drawerBtn = page.getByRole('button', { name: 'Open conversations' })
    await expect(drawerBtn).toBeVisible()
    await drawerBtn.click()

    const dialog = page.getByRole('dialog', { name: 'Conversations' })
    await expect(dialog).toBeVisible()
    // The drawer hosts the same rail — its rows render inside the dialog.
    await expect(dialog.locator('.gf-co-rail-item')).toHaveCount(3)

    await page.keyboard.press('Escape')
    // The drawer unmounts entirely when closed (returns null), not just hides.
    await expect(dialog).not.toBeAttached()
  })
})
