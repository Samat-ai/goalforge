# GoalForge — Incremental Restyle Guide

**For: integrating the redesign into the existing `Samat-ai/goalforge` React app (apps/web).**

This is **not** the "rebuild from scratch" handoff (`../README.md`). That doc tells you to recreate
five screens — which is why Claude Code chokes: it tries to merge two whole apps and silently drops
your real features (Clerk auth, routing, hooks, mutations, modals).

This guide flips the job: **keep every existing component, hook, route, and feature exactly as-is, and
only change how things _look_.** Logic is off-limits. The unit of work is "restyle one file," never
"replace one screen."

---

## 0. The golden rules (paste these into every Claude Code prompt)

```
You are restyling an existing, working React app to match a visual spec.
HARD RULES:
- Do NOT change component props, hooks, state, data fetching, routing, or behavior.
- Do NOT add, remove, or rename components or files (except where this guide says to).
- Do NOT read or import the redesign HTML. Use ONLY the tokens + recipe below.
- Change ONLY: colors, fonts, spacing, radii, borders, shadows, and the JSX needed
  to apply them. If a change would touch logic, STOP and ask.
- Work on ONE file at a time. After each file, the app must still build and run.
```

Give Claude Code: **this guide + the ONE file you're restyling**. Nothing else. Never point it at the
`.html` prototype — that's the placeholder-logic app that confuses it.

---

## 1. Order of operations (smallest blast radius first)

Do these in order. Each step is independently shippable and reviewable.

1. **Tokens** — update `lib/theme.ts` (§2). Touches everything, but it's one tiny file and purely values.
2. **Primitives** — `ui/Btn.tsx`, `ui/Badge.tsx`, `ui/Skeleton.tsx` (§3).
3. **Persistent layout + animated nav** — new `Layout.tsx` + restyled `AppHeader.tsx` (§4). This is the
   fix for the nav-pill animation. It's structural, so it gets its own ready-to-paste code.
4. **Cards & lists** — `GoalCard.tsx`, `DailyTaskList.tsx`, `SprintRail.tsx`, `TodayBar.tsx`, `AddGoal.tsx` (§5).
5. **Modals & widgets** — `RewardModal`, `CollectionModal`, `EnergyModal`, `StarShop`, `CompanionWidget`, `FocusOverlay`.
6. **Pages last** — `pages/Dashboard`, `Analytics`, `Stars`, `Coach`, `Settings`. By now they're mostly
   composition; you're only adjusting page-level spacing/headers.

Ship after each numbered step. If something breaks, you know exactly which step did it.

---

## 2. Tokens — `apps/web/src/lib/theme.ts`

Your `T` object drifted from the redesign. Replace the values (keep the keys + `as const` so nothing
else breaks). Note `serif` is actually your display font — point it at Space Grotesk.

```ts
export const T = {
  bg: "#08080f", surface: "#121220", card: "#121220",
  card2: "#16162a", cardHi: "#1a1a30",
  border: "rgba(255,255,255,0.07)", borderHi: "rgba(255,255,255,0.13)",
  orange: "#ff6a3d",            // accent (was #f97316)
  indigo: "#818cf8", emerald: "#34d399",
  rose: "#fb7185", amber: "#fbbf24", gold: "#fbbf24",
  muted: "#6b6c84", dim: "#6b6c84",
  text: "#f1f1f7", textDim: "#abacc4", textMute: "#6b6c84",
  serif: "'Space Grotesk', sans-serif",   // DISPLAY font (rename mentally; keep key)
  body:  "'Hanken Grotesk', sans-serif",   // NEW — body text
  mono: "'JetBrains Mono', monospace",
} as const;
```

**Shape / depth (use these literals wherever the recipe says so):**
- radius: cards **20px**, buttons **13px**, icon buttons **12px**, pills/nav **99px**
- padding: card **22px** (compact **16px**); gap **14px** (compact **10px**)
- shadow: `0 1px 2px rgba(0,0,0,.4), 0 14px 40px -22px rgba(0,0,0,.7)`
- shadow-hi: `0 2px 4px rgba(0,0,0,.4), 0 26px 60px -28px rgba(0,0,0,.85)`
- accent-soft = `color-mix(in oklab, var(--accent) 16%, transparent)` → in inline styles use `${T.orange}29`
- accent-line = accent 36% → `${T.orange}5c`
- page bg = two faint radial gradients (accent top-left, emerald bottom-right) over `T.bg`, fixed.

**Fonts** — add to `index.html` (you already load JetBrains Mono):
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**Light theme** (if you support it): bg `#edeff3`, card `#f8f9fc`, text `#14141d`, textDim `#565869`,
border `rgba(18,20,32,.07)`, emerald `#0a9d68`.

---

## 3. Primitive recipes

### `ui/Btn.tsx`
Keep the `BtnProps` interface and the `variant` map shape — only change the values:
- radius `8` → **`13`**, fontSize stays mono 12/11.
- `primary`: background **`linear-gradient(140deg, color-mix(in oklab, ${T.orange} 88%, #fff 6%), ${T.orange})`**, color `#fff`. Add hover `transform: translateY(-2px)` + accent shadow, `:active` `scale(.96)`.
- `ghost`: keep transparent + `1px ${T.border}`; hover bg `${T.cardHi}`.
- `success`: `${T.emerald}20` bg, `${T.emerald}` text, `${T.emerald}40` border (unchanged — already matches).
- padding: `9px 18px` → **`0 18px` with `height:44px`** (regular), small `height:36px`.
**Do not touch** the `loading`/`disabled` logic.

### `ui/Badge.tsx`
Chip shape: `height ~26px`, `border-radius 99px`, mono 11px, `padding 5px 11px`, color-coded with the
`color-mix … 7-12% bg + 25-38% border` pattern. Map semantic colors: category → indigo/emerald/orange,
streak/flame → `T.gold`, success → `T.emerald`, danger → `T.rose`.

### `ui/Skeleton.tsx`
Just swap base color to `T.card2` and shimmer highlight to `T.cardHi`; keep dimensions/logic.

---

## 4. Persistent layout + animated nav pill (the nav-animation fix)

**Why your animation doesn't work today:** (1) the nav uses a per-link `borderBottom` toggle — there's no
single element that _moves_; (2) `AppHeader` is rendered _inside each page_, so React Router unmounts and
remounts it on every navigation — any indicator is recreated from scratch, so it can't glide.

**Fix = two changes:** render the header **once** in a persistent layout route, and replace the border with
**one shared pill** measured off the active link. Ready-to-paste files are in this folder:

- **`Layout.tsx`** → put at `apps/web/src/Layout.tsx`
- **`AppHeader.tsx`** → replaces `apps/web/src/components/AppHeader.tsx`

Then change `App.tsx` so the five authed routes are **children of one Layout route** (header stops
remounting):

```tsx
import Layout from './Layout'

// inside <Routes> — wrap the authed destinations in a single layout route:
<Route element={<AuthGuard><OnboardingGuard><Layout /></OnboardingGuard></AuthGuard>}>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/analytics" element={<Analytics />} />
  <Route path="/stars"     element={<Stars />} />
  <Route path="/coach"     element={<Coach />} />
  <Route path="/settings"  element={<Settings />} />
</Route>
```

`Layout` renders `<AppHeader/>` + `<Outlet/>`, so the header persists across those routes and the pill
glides. **Remove the now-duplicate `<AppHeader/>` from each page component** (the pages keep everything
else). Keep `LandingPage`, `SignIn`, `SignUp`, `Onboarding` OUTSIDE the layout — they have no app header.

> `pts` used to be passed into `AppHeader` by each page. In `Layout.tsx` it's fetched once from your
> profile/points source — wire that line to your real hook (it's commented).

---

## 5. Component recipes (keyed to YOUR files)

Prototype file → your file. Apply the visual recipe; **do not change props/data/behavior.**

| Redesign source | Your file | What to restyle |
|---|---|---|
| `gf-goalcard.jsx` | `components/GoalCard.tsx` | card: bg `T.card`, radius **20**, padding **22**, `1px T.border`, shadow. Title: display font **17px/600**, `-0.015em`. Meta row: mono 12px `T.textMute`. Progress ring/bar: track `rgba(255,255,255,.07)`, fill `linear-gradient(90deg, T.orange, color-mix(… T.emerald))`. Chips per §3 Badge. Expand/collapse uses `grid-template-rows 0fr→1fr .34s` — keep your toggle state, just the CSS. |
| `gf-dashboard.jsx` (task list) | `components/DailyTaskList.tsx` | rows: 1px `T.border` divider, mono meta, checkbox → on check play `scale .78→1.16→1` + fading ring (gated on `prefers-reduced-motion: no-preference`). Keep your toggle mutation. |
| `gf-dashboard.jsx` (sprint rail) | `components/SprintRail.tsx` | segmented/stepped rail; active segment accent; mono labels 11px uppercase `0.08em`. |
| `gf-dashboard.jsx` (today strip) | `components/TodayBar.tsx` | greeting display font; "{done} of {total} tasks"; right-aligned progress fill `width 1s ease-out`. |
| `gf-dashboard.jsx` (goal hero) | `components/AddGoal.tsx` | big rounded card, eyebrow mono uppercase, pill input + spark icon, send button lights up when filled, category chips. Keep your submit handler. |
| `gf-stars.jsx` / star + shop | `components/StarShop.tsx` | reward rows: icon tile `T.gold` 12% bg, mono cost, progress fill `T.gold`, redeem button states. |
| `gf-coach.jsx` | `pages/Coach.tsx` + `hooks/useCoach` | empty state (big Solly, title `clamp(26–33px)`, 2×2 prompt grid, full-width accent button); active chat (32px Solly avatar, 5-seg intake bar, streamed replies). **Keep `useCoach` + your AI backend untouched** — restyle the view only. |
| `gf-analytics.jsx` | `pages/Analytics.tsx` | stat cards lift on hover; stage bar; mono captions. |
| `gf-settings.jsx` | `pages/Settings.tsx` + `hooks/useSettings` | theme/accent/font/density/motion controls as segmented rows. These map to tokens — wire to your existing settings store, don't invent new state. |
| modals | `RewardModal`, `CollectionModal`, `EnergyModal` | card surface `T.card`, radius 20, shadow-hi, accent-tinted headers. Keep open/close + data. |
| `GamificationSvgs.tsx` | same | recolor stage art with `T.orange/gold/emerald/indigo`; keep the SVGs. |

**Solly mascot** (Chat + dashboard): use `<video>` with the transparent WebM (`solly-idle-alpha.webm`)
over a static PNG fallback, fade-in + play once every ~7–16s. Do **not** continuously transform the
full-res video. See `../README.md` → "Solly mascot animation" for the layered approach.

---

## 6. Per-file prompt template for Claude Code

```
Restyle apps/web/src/components/GoalCard.tsx to match the GoalForge redesign.

Follow RESTYLE-GUIDE.md §0 golden rules and §5 GoalCard recipe.
Use only lib/theme.ts tokens (already updated). Change only visual styling +
the JSX needed to apply it. Do NOT change props, hooks, mutations, the expand
state, or any data. Show me a diff before writing.
```

Repeat per file, in the §1 order. Small, mechanical, reviewable — the app stays green the whole way.
