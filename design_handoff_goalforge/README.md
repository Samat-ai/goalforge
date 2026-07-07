# Handoff: GoalForge — App, Onboarding & Landing

## Overview
GoalForge is a goal-setting product built around **Solly**, an orange star mascot. A user describes a goal in plain language; an AI "Chat" coach turns it into a structured SMART plan with sprint milestones and daily tasks. Finishing tasks earns star points that evolve Solly through stages. This bundle contains three high-fidelity HTML design references:

1. **App / main website** — the signed-in product (Dashboard, Analytics, Logs, Chat, Settings).
2. **Onboarding** — first-run flow that greets the user as Solly and forges their first goal.
3. **Landing page** — the marketing/home page (Solly-forward hero, chat demo, "Meet Solly", stages, stories, CTA).

## About the Design Files
The files in this bundle are **design references created in HTML/CSS/JS** — prototypes that demonstrate the intended look, motion, and behavior. They are **not** production code to copy verbatim. The task is to **recreate these designs in your target codebase** (React, Vue, SwiftUI, native, etc.) using its established patterns, component library, routing, and state management. If no app environment exists yet, pick the most appropriate framework and implement the designs there.

The app prototype is built as **React 18 via in-browser Babel** with the UI split across `gf-*.jsx` files that attach components to `window`. This was a prototyping convenience — in production these should become real modules/components in your build system. The CSS lives in one big `<style>` block inside `GoalForge Redesign.html` and is driven entirely by CSS custom properties (design tokens), which port cleanly to any styling solution.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion, and interactions are all specified. Recreate the UI pixel-for-pixel using your codebase's libraries, then wire up the real data/AI layer (the prototypes use scripted/mock data).

---

## Design Tokens

Fonts (Google Fonts) — shared across all three pages:
- **Display:** `Space Grotesk` (400/500/600/700)
- **Body:** `Hanken Grotesk` (400/500/600/700/800)
- **Serif accent (editorial):** `Instrument Serif` (italic available)
- **Mono:** `JetBrains Mono` (400/500/600)

### App tokens (`GoalForge Redesign.html`)
The app ships **dark by default** with a light theme via `.gf-root[data-theme="light"]`. Accent is user-tweakable; default is orange.

Brand / accent:
- `--accent` default **`#ff6a3d`** (orange). Selectable palette `ACCENTS = ['#ff6a3d','#7c6bff','#34d399','#38bdf8']` (orange, purple, green, blue).
- `--ring-2` (success/green) `#34d399` · `--gold` `#fbbf24` · `--rose` `#fb7185` · `--indigo` `#818cf8`
- Derived: `--accent-soft` = accent 16% over transparent, `--accent-line` = accent 36%, `--accent-ink` = accent.

Dark theme:
- `--bg #08080f` · `--card #121220` · `--card-2 #16162a` · `--card-hi #1a1a30`
- `--border rgba(255,255,255,.07)` · `--border-hi rgba(255,255,255,.13)`
- `--text #f1f1f7` · `--text-dim #abacc4` · `--text-mute #6b6c84`

Light theme (`[data-theme="light"]`):
- `--bg #edeff3` · `--card #f8f9fc` · `--card-2 #f2f4f8` · `--card-hi #fbfcff`
- `--border rgba(18,20,32,.07)` · `--border-hi rgba(18,20,32,.13)`
- `--text #14141d` · `--text-dim #565869` · `--text-mute #8a8c9b` · `--ring-2 #0a9d68`

Shape / depth / rhythm:
- `--radius 20px` (`--r-sm` = 10px); buttons 13px; pills/nav 99px; icon buttons 12px
- `--pad 22px` · `--gap 14px` (compact density: `--pad 16px`, `--gap 10px`)
- `--shadow 0 1px 2px rgba(0,0,0,.4), 0 14px 40px -22px rgba(0,0,0,.7)`
- `--shadow-hi 0 2px 4px rgba(0,0,0,.4), 0 26px 60px -28px rgba(0,0,0,.85)`
- Page background = two faint radial gradients (accent top-left, green bottom-right) over `--bg`, `background-attachment: fixed`.

Tweakable preferences (persisted by the prototype's tweaks panel; treat as user settings): `themeMode` (dark/light), `accent`, `font` (`modern` = Space Grotesk / `editorial` = Instrument Serif display), `density`, `createStyle`, motion mode (`subtle` disables decorative animations).

### Landing tokens (`landing/GoalForge Landing.html`)
Warm palette, **light default** with `[data-theme="dark"]`:
- `--accent #ff6a3d` · `--accent-2 #ff9a3d` · `--peach #ffd9b0` · `--green #1f9d6b` · `--gold #e0992a` · `--indigo #6d6ae6` · `--rose #f0617a`
- Light: `--bg #fbf5ec` · `--warm #fff3e4` · `--card #fffdf9` · `--text #241c14` · `--text-dim #6a5d50`
- Dark: `--bg #1a140f` · `--warm #2a1f16` · `--card #241a12` · `--text #f6ece0` · `--text-dim #c4b3a0`
- `--maxw 1180px`; primary buttons are pill-shaped gradient (`linear-gradient(135deg, var(--accent), var(--accent-2))`, white text).
- Hero title: `Space Grotesk` 700, `clamp(44px,7.6vw,92px)`, with `Instrument Serif` italic accent words in `--accent`.

### Onboarding tokens (`app/GoalForge Onboarding.html`)
Self-contained; same fonts. `--accent #ff6a3d`, `--accent-2 #ff9a4d`, `--green #34d399`, `--indigo #818cf8`. Card-centered single-screen wizard on a soft gradient.

---

## Screens / Views

### A. APP — `app/GoalForge Redesign.html`
Persistent **sticky header**: logo `Goal` + accent `Forge` (Space Grotesk 21px), a centered pill **nav with a sliding active-pill** (animated `transform`/`width`, ~0.44s), and right side showing the user's current stage points pill + avatar. Header height 62px, max-width 1180px, blurred translucent background.

Nav tabs (`NAV` in `gf-app.jsx`): **Dashboard** (grid), **Analytics** (chart), **Logs** (spark), **Chat** (chat icon), **Settings** (gear). Page transitions cross-fade.

> Note: the tab whose id is `coach` is **labeled "Chat"** in the UI. Keep the route/id but display "Chat".

**1. Dashboard** (`gf-dashboard.jsx`)
- **Greeting strip**: a **waving-hand** graphic (`assets/waving-hand.svg`, ~34px, waves once on load then rests), `"{greeting}, {name}"` in display font, "{done} of {total} tasks done today", and a right-aligned circular/linear today-progress percentage.
- **Goal-creation hero** (the centerpiece): a large rounded card with ambient blobs, eyebrow "What's your next goal?", a **pill input** with a spark icon, an animated **typewriter placeholder** cycling example goals, a send button that lights up when filled, and a row of category chips (Get fit, Learn something, Financial goal, Creative project, Wellness) that prefill prompts. Submitting shows an "AI is forging your plan…" → "Goal added!" status. (`createStyle` tweak toggles glass vs. other treatments.)
- **Your goals** list with a segmented control: `active / achieved / abandoned` (counts shown). Cards come from `GoalCard` (`gf-goalcard.jsx`) — expandable, with progress ring, sprint/task checkboxes that toggle done state and trigger a confetti celebration.

**2. Analytics** (`gf-analytics.jsx`) — charts/stats of progress & streaks (`gf-stars.jsx` powers the star/stage visuals, `charts` logic in the jsx). Stage system: user accumulates star points and evolves Solly through named stages (e.g., Speck → … → Luminary/Celestial).

**3. Logs** — activity/star log list.

**4. Chat** (`gf-coach.jsx`) — an AI goal-coach chatbox.
- **Empty state ("Let's forge your next goal")**: a large **Solly idle animation** (see Mascot/animation notes), a bold title `clamp(26px,3.4vw,33px)`, a 16px description, a 2×2 grid of starter prompts (15px), and a full-width accent **"Start coaching session"** button. The whole section is sized to fit the viewport without scrolling (Solly capped by `min(clamp(130px,22vw,185px),22vh)`).
- **Active chat**: header shows a **small Solly avatar (32px)** + "Chat" + status line + a 5-segment intake progress bar. Scripted 5-question intake (`INTAKE`) with quick-reply chips; assistant replies stream in word-by-word (ChatGPT-style) with a randomized "Thinking…" indicator. After Q5 it "forges" a **Plan card** (SMART title, description, sprint milestones, first tasks, "Add to my goals" / "Refine plan"). Composer: auto-growing textarea, Enter to send / Shift+Enter newline, send button enabled only with input.

**5. Settings** (`gf-settings.jsx`) — theme mode, accent, font, density, motion preferences (these map to the tokens above).

### B. ONBOARDING — `app/GoalForge Onboarding.html`
Single self-contained card-centered wizard. **Solly avatar** (116px) made of cross-fading face SVGs (`assets/solly-wink.svg`, `solly-sussy.svg`, `solly-sunglasses.svg`, `solly-kiss.svg`) with a breathing glow and gentle bob. Panels: **Welcome** ("Hi, I'm Solly · your goal buddy") → **How it works** (Solly builds your SMART plan / earn stars, evolve your creature) → **goal entry** with chips + a "Solly is shaping your goal…" thinking state → **finish** ("Let's forge it ✨", shows the user's first task). Step dots track progress.

### C. LANDING — `landing/GoalForge Landing.html`
Marketing page on the warm palette. Fixed top nav (logo with `assets/Solly.png`, links, theme toggle, primary CTA). Sections:
- **Hero**: monospace eyebrow with a waving 👋, a big **interactive Solly** (inline SVG `solly-svg` + a transparent-keyed greeting video `solly-canvas`/`<video>` that plays on hover/click; bobs on idle, hops on click, winks), floating speech bubbles, `clamp(44–92px)` headline with serif-italic accent words, sub, and two CTAs.
- **Chat demo card**, **How it works** (3 steps), **Meet Solly** (cross-fading face carousel via `solly-wink/sussy/...svg`), **Stages**, **Stories/quotes**, **final CTA card**, footer.
- Decorative blurred color blobs animate in the background (respect `prefers-reduced-motion`).

---

## Interactions & Behavior (highlights)
- **Animated nav pill**: measure active button offset/width, translate a pill behind it (~0.44s ease). Same pattern for the Dashboard segmented control.
- **Confetti celebration** on completing a task/goal (accent + green/gold/purple burst).
- **Streaming assistant text**: reveal reply word-by-word (~42ms/word); skip animation under reduced motion.
- **Typewriter placeholder** on the goal input.
- **Page cross-fades** between tabs; `Reveal`/`useInView` fade-up on scroll.
- **Reduced motion**: a `motion: "subtle"` setting and `@media (prefers-reduced-motion)` disable decorative loops; content must still be visible (never leave elements stuck at opacity 0).
- **Accessibility**: visible `:focus-visible` outline (2px accent) on every interactive element; hit targets ≥ ~36–44px.

### Solly mascot animation (Chat empty state) — important
The transparent idle clip is `app/assets/solly-idle-alpha.webm` (real alpha channel, ~5s, ~15fps). To keep cooldown smooth and cheap, the prototype uses **two stacked layers**:
- a lightweight **static PNG** (`assets/solly.png`, 497²) that does a gentle GPU-composited bob (`translate3d` keyframe + `will-change: transform`) during cooldown, and
- the **webm**, hidden (`opacity:0`, paused, no decode), which **fades in and plays once every ~7–16s**, then fades back to the PNG.

Do **not** continuously transform/animate the full-res video (it stutters and is costly). In production, prefer a true vector **Lottie** idle or a higher-fps alpha clip; the layered approach is the fallback that made the low-fps clip feel smooth. The **landing page** plays its Solly clips as **transparent webms directly** (native alpha — `solly-greet.webm` on the hero, `solly-hero.webm` on the CTA), crossfading from a static layer; the hero greeting is intentionally cut at ~4.0s (before Solly turns and walks off-frame) via the `END` arg in the `makeKeyer` helper.

## State Management (app)
Prototype state is React `useState` with mock data (`gf-data.jsx`): goals (with sprints + tasks, each `{id, done}`), achieved goals, profile (name, greeting), and stage/points. Key transitions: toggling a task → recompute progress + celebrate; submitting a goal → "forging" status → add goal; chat intake → step index 0…4 → forge plan card. Tweak/preference state is persisted (theme, accent, font, density, motion). **In production, replace mock data with your real data layer and the scripted coach with your actual AI/chat backend.**

## Assets
All Solly mascot art is custom to this project.
- **App** (`app/assets/`): `solly.png` (mascot, transparent PNG used for chat avatar + idle rest frame), `solly-idle-alpha.webm` (transparent idle clip), `waving-hand.svg` (dashboard greeting), plus face SVGs used by onboarding (`solly-wink/sussy/sunglasses/kiss.svg`).
- **Landing** (`landing/assets/`): `Solly.png` (hero + chat-head mascot), transparent clips `solly-greet.webm` (hero greeting) and `solly-hero.webm` (CTA idle), and the "Meet Solly" face carousel SVGs (`solly-wink/sunglasses/sussy/kiss/tired/sad/gangster.svg`). The hero/CTA also render an inline `solly-svg` vector (no asset file).
Fonts load from Google Fonts. Icons are inline SVG (no external icon dependency).

## Files
```
design_handoff_goalforge/
├── README.md                      ← this file
├── app/                           ← main website + onboarding
│   ├── GoalForge Redesign.html    ← APP shell + all CSS (design tokens live here)
│   ├── GoalForge Onboarding.html  ← ONBOARDING (self-contained)
│   ├── gf-app.jsx                 ← header/nav, routing, tweak defaults, ACCENTS
│   ├── gf-dashboard.jsx           ← Dashboard (greeting, goal-creation hero, goal list)
│   ├── gf-coach.jsx               ← Chat coach + Solly idle animation component
│   ├── gf-goalcard.jsx            ← expandable goal card
│   ├── gf-analytics.jsx           ← Analytics
│   ├── gf-stars.jsx               ← Logs / star + stage visuals
│   ├── gf-settings.jsx            ← Settings (theme/accent/font/density/motion)
│   ├── gf-ui.jsx                  ← shared primitives (Icon, Ring, Segmented, Reveal, etc.)
│   ├── gf-data.jsx                ← mock data
│   ├── tweaks-panel.jsx           ← in-prototype tweak controls (not for production)
│   └── assets/                    ← mascot art + idle clip
└── landing/
    ├── GoalForge Landing.html     ← LANDING (self-contained)
    └── assets/                    ← mascot art + greeting/hero videos
```

Open any HTML file directly in a browser to view the reference. The app pages need their sibling `gf-*.jsx`/`assets/` next to them (already arranged above).

---

## Tech Stack & Integration

**Recreate in your existing stack — don't ship these files.** The prototype is framework-light on purpose so it ports cleanly. What's actually used:

| Concern | In the prototype | Port to your codebase as |
|---|---|---|
| Components | React 18 loaded via **in-browser Babel** (`<script type="text/babel">`), components attached to `window` | Real components/modules in your build (JSX/TSX, Vue SFCs, SwiftUI views…). The component split in `gf-*.jsx` maps 1:1 to suggested components. |
| Styling | One global `<style>` block of plain CSS driven by **CSS custom properties** (tokens) | Your styling system (CSS Modules, Tailwind, styled-components, native styles). Lift the tokens verbatim — see **Design Tokens** above. `color-mix()` / `clamp()` are used; keep or precompute. |
| State | React `useState` + props; mock data in `gf-data.jsx` | Your state/store + real API. Replace the scripted coach (`gf-coach.jsx` `INTAKE`/`REPLIES`) with your AI/chat backend. |
| Routing | local `tab` state switching pages | Your router (one route per nav destination: dashboard / analytics / logs / chat / settings). |
| Animation | **100% CSS** (`transition`/`@keyframes`) + small vanilla JS (`IntersectionObserver`, `requestAnimationFrame`, class toggles). No animation library. | Keep the CSS values verbatim (see **Animation Spec**). In React, the reveal/idle observers become a small `useInView` hook + effect (already modeled by `Reveal`/`SollyIdle` in the prototype). Framer Motion is optional sugar — not required to match. |
| Icons | inline SVG (`Icon` component in `gf-ui.jsx`) | Your icon set, or copy the inline SVGs. No icon dependency. |
| Fonts | Google Fonts: Space Grotesk, Hanken Grotesk, Instrument Serif, JetBrains Mono | Same families via your font pipeline. |
| Mascot | transparent-alpha WebM clips + PNG fallback, played natively | `<video>` with the WebM (and a static image fallback). For a lighter/cleaner long-term asset, a **Lottie** idle is the recommended upgrade. |
| Persistence | `localStorage` for theme/tweak prefs; URL has no state | Your settings store. Keys are prototype-only — re-map to your prefs model. |

**Recommended target if you have no stack yet:** React + TypeScript with plain CSS (or CSS Modules) using the tokens here, `IntersectionObserver` for reveals, and a `<video>`/Lottie mascot. That's the closest match to the prototype with zero extra deps.

## Animation Spec
Exact values, so motion matches regardless of stack. All decorative loops are disabled under `prefers-reduced-motion: reduce` and (in the app) a `data-motion="subtle"` setting; entrance animations use a **visible base state** so content is never stuck hidden if JS/animation is paused.

**App (`GoalForge Redesign.html`)**
- **Nav pill (active-tab slide):** `transition: transform .44s cubic-bezier(.4,0,.2,1), width .44s cubic-bezier(.4,0,.2,1), opacity .25s ease`. JS measures the active button's `offsetLeft`/`offsetWidth` and translates the pill. Same pattern for the segmented control (`.gf-seg-pill`).
- **Page change (cross-fade):** out → `opacity 0 / translateY(10px) scale(.994)` over `.16s cubic-bezier(.4,0,1,1)`; in → `opacity 1 / none` over `.42s cubic-bezier(.2,.7,.2,1)`.
- **Card/section entrance (`Reveal`):** `@keyframes gfReveal` from `opacity:0; translateY(14px)` → visible, `.62s cubic-bezier(.16,1,.3,1) forwards`; triggered when in view (IntersectionObserver). Base state is opacity:1.
- **Task check:** `gfCheckPop` (scale .78→1.16→1) + `gfCheckRipple` (.58s, fading ring) — gated on `@media (prefers-reduced-motion: no-preference)`.
- **Progress bars/rings:** width/stroke `transition … 1s ease-out` (e.g. `.gf-greet-prog-fill width 1s`).
- **Dashboard waving hand:** `@keyframes gfWave` (rotate 0→15→-8→11→-5→0), `2.8s ease-in-out .4s 1 both` — plays **once** on load.
- **Chat Solly idle:** static PNG bob `@keyframes sollyFloat` (`translate3d(0,0,0)`→`(0,-7px,0)`) `5s ease-in-out infinite` (GPU-composited via `will-change:transform`); the transparent WebM fades in and plays **once every ~7–16s**, then crossfades back to the PNG.
- **Hover/press:** buttons `:active { transform: scale(.95/.96) }`; accent button hover `translateY(-2px)` + shadow; cards lift on hover (`.gf-stat`, `data-motion="playful"` adds `translateY(-4px) scale(1.008)`).
- **Mobile menu:** burger bars morph to ✕ over `.25s cubic-bezier(.2,.7,.2,1)`; panel `@keyframes gfMenuIn` `opacity/translateY(-10px)→0` `.22s cubic-bezier(.2,.7,.2,1)`.
- **Decorative loops:** `floaty 4.5s`, `glowy 3s`, `twinkle 2.4s` — all disabled by `data-motion="subtle"`.

**Landing (`GoalForge Landing.html`)**
- **Scroll reveals (`.reveal`):** `opacity:0; translateY(26px)` → `1/none`, `transition .7s cubic-bezier(.2,.6,.3,1)`, staggered `transition-delay: (i % 3) * 70ms`. Trigger: `IntersectionObserver` `threshold:0.12` → add `.in`, then `unobserve`. Reduced-motion shows immediately.
- **Stat count-up:** animates 0→value over **1400ms**, ease-out cubic `1-(1-p)^3`, fired once on intersect.
- **Marquee ticker:** `@keyframes scrollx` `translateX(0→-50%)`, `30s linear infinite`, `animation-play-state: paused` on hover; off under reduced-motion.
- **Hero Solly:** idle bob `sollyBob` `translateY(0→-12px)` `4.6s ease-in-out infinite`; click "hop" `sollyHop .6s cubic-bezier(.3,1.4,.5,1)` (rise + squash-stretch); hover/click plays the greeting WebM, crossfaded `opacity .25s` (cut at ~4.0s so the clip ends before Solly turns away); eyebrow wave `wavehand 2.4s ease-in-out infinite`.
- **Background blobs:** `float 24s ease-in-out infinite`; off under reduced-motion.
- **Hamburger:** identical pattern to the app — bars→✕ `.26s cubic-bezier(.2,.7,.2,1)`, panel `opacity .22s` + `transform .26s` from `translateY(-10px)`.
- **Buttons:** pill primary hover `translateY(-2px)` + accent shadow; theme toggle hover rotate.

**Onboarding (`GoalForge Onboarding.html`)**
- **Panel transitions** between steps; **step dots** grow active `width .5s cubic-bezier(.34,1.2,.4,1)`; Solly **breathe** glow + **bob**; **starfield** twinkle + occasional **shooting star**; **confetti** burst on finish. Buttons: `:active scale(.97)`, primary hover lift.

## Integration Checklist
1. Lift the **design tokens** (colors, type, spacing, radii, shadows) into your theme. Support the dark/light variants.
2. Wire the 4 Google Font families.
3. Build the **5 app destinations** + **onboarding** + **landing** as components/screens in your stack, using `gf-*.jsx` as the component map.
4. Replace **mock data** (`gf-data.jsx`) and the **scripted chat** with your real data + AI backend.
5. Recreate animations from the **Animation Spec** (copy CSS values verbatim); keep the reduced-motion + visible-base-state behavior.
6. Use a transparent-alpha `<video>` (or Lottie) for the Solly mascot; keep the play-occasionally + crossfade behavior.
7. Keep accessibility: visible `:focus-visible` rings, ≥44px touch targets, accessible names on icon buttons, `alt` on images.
8. Verify responsive behavior — hamburger nav under ~700px (app) / ~760px (landing), grids collapse, full-width primary buttons on phones.
