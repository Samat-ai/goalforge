// pages/LandingPage.tsx — transcribed verbatim (structure, copy, animation)
// from `design_handoff_goalforge/landing/GoalForge Landing.html`, a
// self-contained marketing prototype with its own <style> block
// (-> ../landing.css) and inline script driving: theme toggle, mobile nav,
// an animated Solly hero (idle image <-> greet video swap + speech bubble
// cycling), a scrolling marquee, a fake chat demo, count-up stats, a
// draggable/shuffle-able "how it works" card deck, a scroll-parallax "Meet
// Solly" face carousel, a brightness-stage grid, testimonial quotes, and a
// final CTA with an inline animated Solly SVG (wave + blink).
//
// Intentional deviations from the prototype (a static mockup, not the real
// app) — Clerk auth wiring, "wiring not markup" per the plan:
//   - The prototype has no sign-in/sign-up affordance at all; its nav, hero
//     and final CTA buttons anchor-scroll to on-page sections. Per the plan
//     ("hero/nav CTAs link to /sign-up, /sign-in; signed-in users redirect
//     to /dashboard — preserve current behavior"), the nav pill ("Let's
//     plan"), the hero primary ("Say hi to Solly") and the final-CTA primary
//     now route to /sign-up (signed-out) or /dashboard (signed-in) via
//     Clerk's <Show> + react-router <Link>, matching the previous
//     LandingPage.tsx's contract. A "Sign in" text link (styled like the
//     nav's own `.nav-links` anchors) was added next to the nav pill for
//     signed-out visitors, mirroring the old page's `Sign in` button.
//   - "See how it works"/"How it works" ghost buttons and all nav section
//     links stay as in-page anchors — real on-page sections, not dead ends.
import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Show } from '@clerk/react'
import '../landing.css'

const THEME_KEY = 'gf-landing-theme'

// The app's global CSS makes <body> the scroll container (html{overflow:hidden};
// body{overflow:auto}), so window.scrollY is always 0. The prototype scrolls the
// window. These helpers make every scroll-driven behavior work in both setups.
function getScrollY() {
  return window.scrollY || document.body.scrollTop || 0
}
function onAnyScroll(handler: () => void): () => void {
  window.addEventListener('scroll', handler, { passive: true })
  document.body.addEventListener('scroll', handler, { passive: true })
  return () => {
    window.removeEventListener('scroll', handler)
    document.body.removeEventListener('scroll', handler)
  }
}

const NAV_LINKS = [
  { href: '#chat', label: 'Chat with Solly' },
  { href: '#how', label: 'How it works' },
  { href: '#stages', label: 'Stages' },
  { href: '#loved', label: 'Stories' },
]

const SPEECH = [
  "Let's do <b>one small thing</b> today ✨",
  "You've got a goal in you 💪",
  "I'll keep your <b>streak</b> alive 🔥",
  'Tiny steps, big glow ⭐',
  'Ready when you are! 👋',
]

const PHRASES = [
  'Run a half-marathon', 'Learn Spanish', 'Read 12 books', 'Launch the side project',
  'Meditate daily', 'Get back into running', 'Write every morning', 'Save 3 months runway',
  'Play guitar', 'Hold a 5-min convo',
]

const SUGGESTIONS = ['I want to get fit', 'Learn to play guitar', 'I keep procrastinating']

const REPLIES: Array<{ k: string[]; r: string }> = [
  { k: ['fit', 'gym', 'weight', 'run', 'exercise', 'workout', 'health'], r: "Love it. 💪 Let's keep it tiny to start — what if today was just a 15-minute walk? I'll build a plan that grows from there." },
  { k: ['guitar', 'music', 'piano', 'draw', 'paint', 'art', 'learn', 'language', 'spanish', 'code'], r: 'Ooh, fun one! 🎸 Ten focused minutes a day beats a big Sunday cram. Want me to map out week one so it never feels overwhelming?' },
  { k: ['procrastin', 'lazy', 'stuck', "can't", 'cant', 'hard', 'overwhelm', 'tired', 'quit'], r: "Totally normal — and not a character flaw. 🙂 Let's shrink it. What's the smallest version of the next step? We'll start there, today." },
  { k: ['book', 'read', 'write', 'study', 'school'], r: "Nice. 📚 Twenty pages a day adds up fast. I'll track your streak so you can see the momentum building." },
  { k: ['business', 'project', 'launch', 'startup', 'side', 'money', 'save'], r: "Big one — I'm in. 🚀 Let's lock the scope and pick one move you can make this week. Small, shipped, repeat." },
]
function replyFor(text: string): string {
  const lt = text.toLowerCase()
  for (const x of REPLIES) if (x.k.some((k) => lt.includes(k))) return x.r
  return "I hear you. 🌟 Let's turn that into a real plan — I'll break it into small daily steps and keep your streak going. Want to start now?"
}

const STATS = [
  { to: 12400, suf: '+', label: 'Goals forged' },
  { to: 94, suf: '%', label: 'Keep their streak' },
  { to: 6, suf: '', label: 'Brightness stages' },
  { to: 60, suf: 's', label: 'To your first goal' },
]

type DeckCard = { step: number; cc: string; icon: React.ReactNode; title: string; body: string; demo: React.ReactNode }
const DECK_CARDS: DeckCard[] = [
  {
    step: 0, cc: 'var(--accent)',
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    title: 'Tell Solly your goal',
    body: "Just talk to it like a friend. Solly asks a couple of gentle questions to really get what you're after.",
    demo: (
      <div className="dc-demo dc-chat">
        <span className="dc-bub them">What have you been meaning to do?</span>
        <span className="dc-bub you">Finally run a 5K 🏃</span>
      </div>
    ),
  },
  {
    step: 1, cc: 'var(--green)',
    icon: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    title: 'Get a doable plan',
    body: 'It breaks the big scary goal into small daily steps you can actually finish between everything else.',
    demo: (
      <div className="dc-demo dc-list">
        <span className="dc-task done"><i /> Walk 15 minutes</span>
        <span className="dc-task done"><i /> Jog one block, walk one</span>
        <span className="dc-task"><i /> Run 5 minutes straight</span>
      </div>
    ),
  },
  {
    step: 2, cc: 'var(--indigo)',
    icon: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />,
    title: 'Keep each other going',
    body: "Solly checks in, cheers your wins, and helps you bounce back on the off days. You're never doing it alone.",
    demo: (
      <div className="dc-demo dc-streak">
        <span className="dc-flame">🔥 7-day streak</span>
        <span className="dc-pts">+120 star points</span>
      </div>
    ),
  },
]

const STAGES = [
  { name: 'Speck', pts: 0, c: '#9b8d7e', sz: 24, lvl: 0.12, desc: 'A tiny spark' },
  { name: 'Ember', pts: 30, c: '#f0617a', sz: 30, lvl: 0.32, desc: 'Warming up' },
  { name: 'Flare', pts: 80, c: '#ff6a3d', sz: 38, lvl: 0.55, desc: 'Momentum builds' },
  { name: 'Luminary', pts: 175, c: '#e0992a', sz: 46, lvl: 0.74, desc: 'Radiating' },
  { name: 'Nova', pts: 350, c: '#f6b73c', sz: 54, lvl: 0.9, desc: 'Brilliant burst' },
  { name: 'Celestial', pts: 600, c: '#6d6ae6', sz: 62, lvl: 1, desc: 'Transcendent' },
]

const QUOTES = [
  { text: 'It feels less like an app and more like a friend texting to check in. I’ve never kept a habit this long.', grad: 'linear-gradient(135deg,var(--accent),var(--gold))', name: 'Priya N.', role: 'Nurse' },
  { text: 'Solly broke ‘learn guitar’ into ten-minute days. Eight weeks in and I can actually play songs.', grad: 'linear-gradient(135deg,var(--green),var(--accent))', name: 'Marco D.', role: 'Student' },
  { text: "The gentle nudges got me through the slump. I didn't quit this time — that's a first.", grad: 'linear-gradient(135deg,var(--indigo),var(--rose))', name: 'Tara L.', role: 'Freelancer' },
]

const MEET_ITEMS = [
  { icon: <path d="M12 8V4l8 8-8 8v-4H4V8z" />, title: "Knows where you're at", body: 'Solly remembers your goals, your streak, and your rough days — so its nudges always feel personal.' },
  { icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>, title: 'Nudges, never nags', body: "A warm check-in when you stall, a high-five when you ship. Encouragement tuned to how you're doing." },
  { icon: <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9 12 2" />, title: 'Celebrates the small stuff', body: 'Every finished task earns star points and brightens your goal. Tiny wins, real momentum.' },
]

const STAR_SVG_PATH = 'M12 1.7l2.72 6.13 6.66.6-5.02 4.44 1.5 6.53L12 16.55 6.14 19.9l1.5-6.53L2.62 8.43l6.66-.6z'

// Inline CTA-section Solly artwork (verbatim path data from the prototype's
// 497x497 SVG). Kept as a raw markup string + ref-based DOM setup (mirrors
// the prototype's `setupSolly()`) so the wave/blink hover interaction can
// reuse the exact same grouping logic instead of hand-splitting ~20 paths
// into JSX.
const CTA_SOLLY_SVG = `<svg class="solly-svg" viewBox="0 0 497 497" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M419.16 260.1C417.627 259.947 415.9 260.167 413.98 260.76C406.64 263.01 397.24 265.07 389.99 267.59C381.363 270.583 374.467 272.867 369.3 274.44C365.32 275.65 361.92 277.52 360.03 280.56C352.32 292.95 343.24 305.11 331.72 313.98C323.067 320.653 314.737 325.793 306.73 329.4C279.357 341.733 250.66 343.353 220.64 334.26C210.473 331.187 200.307 326.247 190.14 319.44C181.227 313.473 174.487 307.73 169.92 302.21C166.69 298.29 161.53 292.47 158.45 287.39C155.65 282.77 153.32 279.163 151.46 276.57C150.934 275.833 150.137 275.33 149.24 275.17C145.25 274.46 141.68 273.76 138.67 272.65C127.73 268.65 116.86 265.363 106.06 262.79C103.45 262.17 99.0601 260.47 95.2501 259.99C92.9501 258.317 91.2401 256.047 90.1201 253.18C88.2601 246.72 89.1701 241.327 92.8501 237C94.7434 234.773 98.2067 232.44 103.24 230C123.733 220.053 139.82 212.19 151.5 206.41C151.533 206.397 151.559 206.372 151.574 206.338C151.589 206.305 151.591 206.266 151.58 206.23C146.233 186.217 141.43 169.223 137.17 155.25C135.177 148.703 134.353 144.06 134.7 141.32C135.79 132.65 143.57 126.1 152.4 126.72C154.32 126.86 157.217 127.54 161.09 128.76C180.963 135.013 198.063 140.39 212.39 144.89C212.54 144.935 212.701 144.928 212.846 144.87C212.992 144.812 213.113 144.706 213.19 144.57C223.257 126.297 232.26 109.76 240.2 94.9601C242.707 90.2801 244.917 87.2367 246.83 85.8301C254.09 80.4801 265.44 81.5801 270.55 89.6901C272.21 92.3301 273.86 95.1767 275.5 98.2301C282.74 111.697 291.067 127.08 300.48 144.38C300.554 144.513 300.671 144.617 300.812 144.673C300.952 144.73 301.107 144.736 301.25 144.69C313.963 140.797 330.713 135.69 351.5 129.37C357.993 127.397 362.517 126.597 365.07 126.97C369.777 127.657 373.577 130.097 376.47 134.29C379.47 138.637 380.19 143.607 378.63 149.2C374.35 164.533 368.907 183.45 362.3 205.95C362.255 206.11 362.271 206.279 362.343 206.427C362.415 206.575 362.538 206.69 362.69 206.75C372.43 210.79 383.07 216.66 393.74 221.79C406.213 227.783 413.42 231.32 415.36 232.4C422.327 236.28 425.41 242.31 424.61 250.49C424.35 253.13 422.533 256.333 419.16 260.1ZM203.29 174.06C207.1 172.77 210.45 172.99 214.37 173.31C214.996 173.361 215.624 173.23 216.179 172.932C216.734 172.634 217.193 172.182 217.5 171.63C219.247 168.477 218.64 166.117 215.68 164.55C215.374 164.382 215.043 164.264 214.7 164.2C209.847 163.293 205.05 163.64 200.31 165.24C195.57 166.84 191.547 169.47 188.24 173.13C188 173.39 187.805 173.687 187.66 174.01C186.253 177.043 187.203 179.287 190.51 180.74C191.089 180.994 191.728 181.076 192.351 180.976C192.973 180.877 193.553 180.6 194.02 180.18C196.94 177.55 199.48 175.34 203.29 174.06ZM310.8 174.34C314.62 175.69 317.15 177.96 320.05 180.65C320.516 181.079 321.096 181.365 321.722 181.473C322.348 181.581 322.993 181.507 323.58 181.26C326.927 179.847 327.913 177.6 326.54 174.52C326.402 174.195 326.213 173.895 325.98 173.63C322.7 169.897 318.68 167.19 313.92 165.51C309.167 163.83 304.34 163.41 299.44 164.25C299.094 164.31 298.76 164.425 298.45 164.59C295.443 166.123 294.797 168.49 296.51 171.69C296.812 172.252 297.27 172.716 297.826 173.024C298.383 173.333 299.017 173.474 299.65 173.43C303.59 173.17 306.98 172.99 310.8 174.34ZM234.83 229.81C234.823 225.803 234.73 223.127 234.55 221.78C232.74 208.07 222.8 197.75 208.49 197.78C194.18 197.81 184.28 208.17 182.53 221.89C182.357 223.237 182.273 225.913 182.28 229.92C182.287 233.933 182.38 236.61 182.56 237.95C184.37 251.66 194.31 261.98 208.62 261.95C222.94 261.92 232.83 251.56 234.58 237.84C234.753 236.5 234.837 233.823 234.83 229.81ZM279.16 229.95C279.173 233.963 279.27 236.64 279.45 237.98C281.27 251.7 291.22 262.01 305.54 261.97C319.85 261.93 329.74 251.56 331.49 237.84C331.663 236.493 331.743 233.813 331.73 229.8C331.723 225.793 331.63 223.117 331.45 221.77C329.62 208.06 319.68 197.74 305.36 197.78C291.04 197.82 281.15 208.19 279.4 221.91C279.233 223.257 279.153 225.937 279.16 229.95ZM256.27 281.85C264.3 282.12 275.25 279.24 276.58 269.7C276.621 269.382 276.604 269.057 276.53 268.74C275.937 266.127 274.177 264.987 271.25 265.32C267.47 265.74 261.87 268.1 256.74 267.93C251.62 267.76 246.19 265.03 242.45 264.35C239.55 263.823 237.713 264.843 236.94 267.41C236.846 267.723 236.808 268.048 236.83 268.37C237.52 277.97 248.25 281.58 256.27 281.85Z" fill="#FA8215"></path>
<path d="M203.29 174.06C199.48 175.34 196.94 177.55 194.02 180.18C193.553 180.6 192.973 180.877 192.351 180.976C191.728 181.075 191.089 180.993 190.51 180.74C187.203 179.287 186.253 177.043 187.66 174.01C187.804 173.687 188 173.39 188.24 173.13C191.547 169.47 195.57 166.84 200.31 165.24C205.05 163.64 209.847 163.293 214.7 164.2C215.043 164.263 215.374 164.382 215.68 164.55C218.64 166.117 219.247 168.477 217.5 171.63C217.193 172.182 216.734 172.634 216.179 172.932C215.624 173.23 214.996 173.361 214.37 173.31C210.45 172.99 207.1 172.77 203.29 174.06Z" fill="#D05D02"></path>
<path d="M313.92 165.51C318.68 167.19 322.7 169.897 325.98 173.63C326.213 173.895 326.402 174.195 326.54 174.52C327.913 177.6 326.927 179.847 323.58 181.26C322.993 181.507 322.348 181.581 321.722 181.473C321.096 181.365 320.516 181.079 320.05 180.65C317.15 177.96 314.62 175.69 310.8 174.34C306.98 172.99 303.59 173.17 299.65 173.43C299.017 173.474 298.383 173.333 297.826 173.024C297.27 172.716 296.812 172.252 296.51 171.69C294.797 168.49 295.443 166.123 298.45 164.59C298.76 164.425 299.094 164.31 299.44 164.25C304.34 163.41 309.167 163.83 313.92 165.51Z" fill="#D05D02"></path>
<path d="M234.83 229.81C234.837 233.823 234.753 236.5 234.58 237.84C232.83 251.56 222.94 261.92 208.62 261.95C194.31 261.98 184.37 251.66 182.56 237.95C182.38 236.61 182.287 233.933 182.28 229.92C182.273 225.913 182.357 223.237 182.53 221.89C184.28 208.17 194.18 197.81 208.49 197.78C222.8 197.75 232.74 208.07 234.55 221.78C234.73 223.127 234.823 225.803 234.83 229.81ZM200.88 224.42C200.62 230.72 200.587 234.647 200.78 236.2C201.6 242.79 206.38 248.43 213.21 249.02C219.89 249.59 226.01 244.5 227.68 238.3C228.45 235.45 227.94 230.86 228.08 227.01C228.28 221.14 227.13 217.2 222.77 213.78C218.637 210.52 214.07 209.887 209.07 211.88C208.984 211.915 208.907 211.97 208.847 212.04C208.787 212.11 208.744 212.194 208.723 212.284C208.703 212.374 208.704 212.467 208.728 212.555C208.752 212.643 208.797 212.724 208.86 212.79C212.073 216.203 212.41 219.493 209.87 222.66C208.4 224.49 204.4 225.56 202.39 224.32C202.017 224.087 201.723 223.95 201.51 223.91C201.434 223.897 201.357 223.901 201.283 223.92C201.209 223.94 201.139 223.975 201.08 224.023C201.02 224.071 200.972 224.131 200.937 224.2C200.903 224.268 200.883 224.343 200.88 224.42Z" fill="#F5F6F8"></path>
<path d="M305.36 197.78C319.68 197.74 329.62 208.06 331.45 221.77C331.63 223.117 331.723 225.793 331.73 229.8C331.743 233.813 331.663 236.493 331.49 237.84C329.74 251.56 319.85 261.93 305.54 261.97C291.22 262.01 281.27 251.7 279.45 237.98C279.27 236.64 279.173 233.963 279.16 229.95C279.153 225.937 279.233 223.257 279.4 221.91C281.15 208.19 291.04 197.82 305.36 197.78ZM286.03 224.24C285.777 230.54 285.747 234.467 285.94 236.02C286.77 242.61 291.56 248.24 298.39 248.82C305.07 249.38 311.18 244.28 312.84 238.08C313.61 235.23 313.09 230.64 313.22 226.79C313.42 220.92 312.26 216.99 307.9 213.57C303.76 210.317 299.193 209.69 294.2 211.69C294.114 211.725 294.037 211.78 293.977 211.85C293.917 211.92 293.874 212.004 293.854 212.094C293.833 212.183 293.834 212.276 293.858 212.365C293.882 212.453 293.927 212.534 293.99 212.6C297.203 216.013 297.543 219.303 295.01 222.47C293.54 224.3 289.55 225.38 287.54 224.14C287.167 223.907 286.873 223.77 286.66 223.73C286.584 223.717 286.507 223.72 286.433 223.74C286.359 223.759 286.289 223.794 286.23 223.843C286.17 223.891 286.122 223.951 286.087 224.02C286.053 224.088 286.033 224.163 286.03 224.24Z" fill="#F5F6F8"></path>
<path d="M286.66 223.73C286.873 223.77 287.167 223.907 287.54 224.14C289.55 225.38 293.54 224.3 295.01 222.47C297.543 219.303 297.203 216.013 293.99 212.6C293.927 212.534 293.882 212.453 293.858 212.365C293.834 212.276 293.833 212.183 293.853 212.094C293.874 212.004 293.917 211.92 293.977 211.85C294.037 211.78 294.114 211.725 294.2 211.69C299.193 209.69 303.76 210.317 307.9 213.57C312.26 216.99 313.42 220.92 313.22 226.79C313.09 230.64 313.61 235.23 312.84 238.08C311.18 244.28 305.07 249.38 298.39 248.82C291.56 248.24 286.77 242.61 285.94 236.02C285.747 234.467 285.777 230.54 286.03 224.24C286.033 224.163 286.053 224.088 286.087 224.02C286.121 223.951 286.17 223.891 286.23 223.843C286.289 223.794 286.359 223.759 286.433 223.74C286.507 223.721 286.584 223.717 286.66 223.73Z" fill="#D05D02"></path>
<path d="M200.88 224.42C200.883 224.343 200.903 224.268 200.937 224.2C200.972 224.131 201.02 224.071 201.08 224.023C201.139 223.974 201.209 223.939 201.283 223.92C201.357 223.9 201.434 223.897 201.51 223.91C201.723 223.95 202.017 224.087 202.39 224.32C204.4 225.56 208.4 224.49 209.87 222.66C212.41 219.493 212.073 216.203 208.86 212.79C208.797 212.724 208.752 212.643 208.728 212.555C208.704 212.466 208.703 212.373 208.723 212.284C208.744 212.194 208.787 212.11 208.847 212.04C208.907 211.97 208.984 211.915 209.07 211.88C214.07 209.887 218.637 210.52 222.77 213.78C227.13 217.2 228.28 221.14 228.08 227.01C227.94 230.86 228.45 235.45 227.68 238.3C226.01 244.5 219.89 249.59 213.21 249.02C206.38 248.43 201.6 242.79 200.78 236.2C200.587 234.647 200.62 230.72 200.88 224.42Z" fill="#D05D02"></path>
<path d="M419.16 260.1C400.44 270.813 381.517 281.32 362.39 291.62C361.39 292.16 360.407 292.973 359.44 294.06C359.175 294.358 358.956 294.692 358.79 295.05L355.39 302.52L345.56 318.92C345.165 319.578 344.926 320.313 344.86 321.07L339.33 387.53C337.663 392.003 334.807 395.507 330.76 398.04C326.93 400.45 321.18 400.38 316.96 399.29C315.633 398.95 313.433 397.737 310.36 395.65C305.313 392.217 300.467 388.937 295.82 385.81L285.81 378.61C285.26 371 286.2 363.62 291.75 357.98C291.829 357.9 291.88 357.796 291.894 357.684C291.908 357.573 291.884 357.46 291.827 357.362C291.77 357.265 291.683 357.19 291.578 357.148C291.474 357.106 291.358 357.1 291.25 357.13C284.7 358.89 278.44 360.97 271.52 361.94C268.84 362.313 266.14 362.713 263.42 363.14C259.94 362.42 256.173 362.23 252.12 362.57C251.824 362.596 251.539 362.696 251.29 362.86L245.32 366.79L246.91 363.1C246.944 363.023 246.958 362.939 246.953 362.855C246.948 362.771 246.923 362.689 246.88 362.617C246.837 362.545 246.777 362.484 246.706 362.439C246.635 362.394 246.554 362.367 246.47 362.36C241.56 361.94 236.55 361.27 231.95 359.78C229.063 358.84 225.867 357.853 222.36 356.82C222.287 356.8 222.208 356.804 222.137 356.83C222.065 356.856 222.003 356.904 221.961 356.967C221.919 357.029 221.898 357.103 221.901 357.177C221.904 357.251 221.932 357.322 221.98 357.38C226.553 363.153 229.113 369.9 229.66 377.62L218.92 385.08C213.527 388.76 208.14 392.51 202.76 396.33C199.7 398.5 197.85 399.03 194.41 399.63C185.65 401.16 179.26 396.53 175.34 388.93C174.627 386.997 174.22 385.46 174.12 384.32C173.927 382.173 173.55 376.733 172.99 368C172.63 362.313 172.21 356.883 171.73 351.71C170.743 341.15 169.957 331.373 169.37 322.38C169.25 320.57 168.51 318.47 167.34 316.86C162.313 309.98 158.383 302.853 155.55 295.48C155.104 294.317 154.261 293.35 153.17 292.75C134.497 282.537 116.313 272.413 98.62 262.38C97.7267 261.873 96.6033 261.077 95.25 259.99C99.06 260.47 103.45 262.17 106.06 262.79C116.86 265.363 127.73 268.65 138.67 272.65C141.68 273.76 145.25 274.46 149.24 275.17C150.137 275.33 150.934 275.833 151.46 276.57C153.32 279.163 155.65 282.77 158.45 287.39C161.53 292.47 166.69 298.29 169.92 302.21C174.487 307.73 181.227 313.473 190.14 319.44C200.307 326.247 210.473 331.187 220.64 334.26C250.66 343.353 279.357 341.733 306.73 329.4C314.737 325.793 323.067 320.653 331.72 313.98C343.24 305.11 352.32 292.95 360.03 280.56C361.92 277.52 365.32 275.65 369.3 274.44C374.467 272.867 381.363 270.583 389.99 267.59C397.24 265.07 406.64 263.01 413.98 260.76C415.9 260.167 417.627 259.947 419.16 260.1Z" fill="#EF7214"></path>
<path d="M256.74 267.93C261.87 268.1 267.47 265.74 271.25 265.32C274.177 264.987 275.937 266.127 276.53 268.74C276.604 269.057 276.621 269.382 276.58 269.7C275.25 279.24 264.3 282.12 256.27 281.85C248.25 281.58 237.52 277.97 236.83 268.37C236.808 268.048 236.846 267.723 236.94 267.41C237.713 264.843 239.55 263.823 242.45 264.35C246.19 265.03 251.62 267.76 256.74 267.93ZM248.49 274.55L239.56 271.82C239.528 271.81 239.494 271.813 239.464 271.828C239.434 271.843 239.411 271.869 239.4 271.9L239.38 271.96C239.325 272.129 239.387 272.332 239.561 272.558C239.736 272.783 240.02 273.027 240.397 273.274C240.774 273.521 241.237 273.767 241.76 273.998C242.282 274.229 242.853 274.441 243.44 274.62L243.71 274.7C244.295 274.879 244.885 275.023 245.446 275.123C246.006 275.223 246.527 275.278 246.977 275.285C247.428 275.291 247.799 275.249 248.071 275.161C248.342 275.073 248.509 274.94 248.56 274.77L248.58 274.71C248.589 274.677 248.585 274.641 248.568 274.611C248.551 274.581 248.523 274.559 248.49 274.55Z" fill="#F5F6F8"></path>
<path d="M248.49 274.55C248.523 274.559 248.551 274.581 248.568 274.611C248.585 274.641 248.589 274.677 248.58 274.71L248.56 274.77C248.509 274.94 248.342 275.073 248.071 275.161C247.799 275.249 247.428 275.291 246.977 275.285C246.527 275.278 246.007 275.223 245.446 275.123C244.885 275.023 244.295 274.879 243.71 274.7L243.44 274.62C242.853 274.441 242.282 274.229 241.76 273.998C241.237 273.767 240.774 273.521 240.397 273.274C240.02 273.027 239.736 272.783 239.561 272.558C239.387 272.332 239.325 272.129 239.38 271.96L239.4 271.9C239.411 271.869 239.434 271.843 239.464 271.828C239.494 271.813 239.528 271.81 239.56 271.82L248.49 274.55Z" fill="#B9C1CB"></path>
<path d="M245.32 366.79L229.66 377.62C229.113 369.9 226.553 363.153 221.98 357.38C221.932 357.323 221.904 357.251 221.901 357.177C221.898 357.103 221.919 357.029 221.961 356.967C222.003 356.904 222.065 356.856 222.137 356.83C222.208 356.804 222.287 356.8 222.36 356.82C225.867 357.853 229.063 358.84 231.95 359.78C236.55 361.27 241.56 361.94 246.47 362.36C246.554 362.367 246.635 362.394 246.706 362.439C246.777 362.484 246.837 362.545 246.88 362.617C246.923 362.69 246.948 362.771 246.953 362.855C246.958 362.939 246.944 363.023 246.91 363.1L245.32 366.79Z" fill="#D05D02"></path>
<path d="M285.81 378.61L263.42 363.14C266.14 362.713 268.84 362.313 271.52 361.94C278.44 360.97 284.7 358.89 291.25 357.13C291.358 357.1 291.474 357.106 291.578 357.148C291.683 357.19 291.77 357.265 291.827 357.363C291.884 357.46 291.908 357.573 291.894 357.684C291.88 357.796 291.829 357.9 291.75 357.98C286.2 363.62 285.26 371 285.81 378.61Z" fill="#D05D02"></path>
</svg>`

function setupSollySvg(svg: SVGSVGElement | null) {
  if (!svg) return
  if (svg.querySelector('.s-body')) return // already wired (React StrictMode re-runs effects)
  const NS = 'http://www.w3.org/2000/svg'
  const body = document.createElementNS(NS, 'g')
  body.setAttribute('class', 's-body')
  while (svg.firstChild) body.appendChild(svg.firstChild)
  svg.appendChild(body)
  const paths = Array.from(body.querySelectorAll('path'))
  function wrap(cls: string, starts: string[]) {
    const sel = paths.filter((p) => { const d = p.getAttribute('d') || ''; return starts.some((s) => d.startsWith(s)) })
    if (!sel.length) return
    const g = document.createElementNS(NS, 'g')
    g.setAttribute('class', cls)
    body.insertBefore(g, sel[0])
    sel.forEach((p) => g.appendChild(p))
  }
  wrap('s-eye s-eye-l', ['M234.83', 'M200.88 224.42'])
  wrap('s-eye s-eye-r', ['M305.36', 'M286.66 223.73'])
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
}
function MoonIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
}

function Reveal({ children, className = '', delayIndex = 0, as: Tag = 'div' }: { children: React.ReactNode; className?: string; delayIndex?: number; as?: 'div' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setInView(true); io.unobserve(e.target) } })
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const Comp = Tag
  return (
    <Comp ref={ref} className={['reveal', inView && 'in', className].filter(Boolean).join(' ')} style={{ transitionDelay: `${(delayIndex % 3) * 70}ms` }}>
      {children}
    </Comp>
  )
}

function StatsBand() {
  const ref = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<number[]>(() => STATS.map(() => 0))
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        io.unobserve(e.target)
        const dur = 1400
        const t0 = performance.now()
        function tick(t: number) {
          const p = Math.min(1, (t - t0) / dur)
          const eased = 1 - Math.pow(1 - p, 3)
          setValues(STATS.map((s) => Math.round(s.to * eased)))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  function fmt(n: number) { return n >= 1000 ? n.toLocaleString() : String(n) }
  return (
    <section className="stats-band">
      <div className="container">
        <div className="stats reveal in" ref={ref}>
          {STATS.map((s, i) => (
            <div className="stat" key={s.label}>
              <div className="n">{fmt(values[i])}{s.suf}</div>
              <div className="l">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="ph-note reveal in">✦ Illustrative figures — replace with real metrics before launch</div>
      </div>
    </section>
  )
}

function HowItWorksDeck() {
  const [order, setOrder] = useState<number[]>(DECK_CARDS.map((c) => c.step))
  const [busy, setBusy] = useState(false)
  const [flyDir, setFlyDir] = useState<number | null>(null)
  const [dragDx, setDragDx] = useState<number | null>(null)
  const [snapStep, setSnapStep] = useState<number | null>(null) // card that just cycled to the back — snaps (no transition), like the prototype
  const dragStartX = useRef(0)
  const lastDx = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shuffle = useCallback((dir: number) => {
    if (busy) return
    setBusy(true)
    setFlyDir(dir)
    shuffleTimerRef.current = setTimeout(() => {
      setOrder((o) => {
        setSnapStep(o[0])
        return [...o.slice(1), o[0]]
      })
      setFlyDir(null)
      setBusy(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setSnapStep(null)))
    }, 470)
  }, [busy])

  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    autoRef.current = setInterval(() => shuffle(-1), 4000)
  }, [shuffle])
  const stopAuto = useCallback(() => { if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null } }, [])

  useEffect(() => {
    startAuto()
    return () => { stopAuto(); if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goToStep(step: number) {
    if (busy) return
    setOrder((o) => {
      const next = [...o]
      let guard = 0
      while (next[0] !== step && guard++ < DECK_CARDS.length) next.push(next.shift() as number)
      return next
    })
  }

  function onPointerDown(e: React.PointerEvent) {
    if (busy) return
    dragStartX.current = e.clientX
    lastDx.current = 0
    setDragDx(0)
    stopAuto()
    try { stageRef.current?.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragDx === null) return
    const dx = e.clientX - dragStartX.current
    lastDx.current = dx
    setDragDx(dx)
  }
  function endDrag() {
    if (dragDx === null) return
    const dx = dragDx
    setDragDx(null)
    if (Math.abs(dx) > 90) shuffle(dx < 0 ? -1 : 1)
    startAuto()
  }

  const POS = [
    { t: 'translateY(0px) scale(1)', o: 1 },
    { t: 'translateY(24px) scale(0.945)', o: 0.9 },
    { t: 'translateY(48px) scale(0.89)', o: 0.78 },
  ]

  return (
    <div className="deck-wrap reveal in">
      <div
        className="deck-stage" id="deck" role="group" aria-label="How it works — three steps, drag or click to shuffle"
        ref={stageRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onClick={(e) => { if ((e.target as HTMLElement).closest('.deck-next')) return; if (Math.abs(lastDx.current) < 6 && !busy) shuffle(-1) }}
      >
        {DECK_CARDS.map((card) => {
          const pos = order.indexOf(card.step)
          const isFront = pos === 0
          let transform = POS[Math.min(pos, POS.length - 1)].t
          let opacity = POS[Math.min(pos, POS.length - 1)].o
          let transition: string | undefined
          if (isFront && flyDir !== null) {
            transform = `translateX(${flyDir * 135}%) rotate(${flyDir * 10}deg) scale(1)`
            opacity = 0
            transition = 'transform .48s cubic-bezier(.55,0,.62,1), opacity .48s'
          } else if (isFront && dragDx !== null) {
            transform = `translateX(${dragDx}px) rotate(${dragDx * 0.04}deg) scale(1)`
            transition = 'none'
          } else if (snapStep === card.step) {
            transition = 'none' // snap straight to the back slot (prototype disables transition for one frame)
          }
          return (
            <article
              key={card.step}
              className={['deck-card', isFront && dragDx !== null && 'dragging'].filter(Boolean).join(' ')}
              style={{ '--cc': card.cc, zIndex: DECK_CARDS.length - pos, transform, opacity, pointerEvents: isFront ? 'auto' : 'none', transition } as React.CSSProperties}
            >
              <div className="dc-top">
                <span className="dc-n">{String(card.step + 1).padStart(2, '0')}</span>
                <span className="dc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{card.icon}</svg></span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              {card.demo}
            </article>
          )
        })}
      </div>
      <div className="deck-foot">
        <div className="deck-dots" id="deckDots">
          {DECK_CARDS.map((card) => (
            <i key={card.step} className={order[0] === card.step ? 'on' : ''} onClick={() => goToStep(card.step)} />
          ))}
        </div>
        <button className="deck-next" onClick={(e) => { e.stopPropagation(); shuffle(-1) }} aria-label="Shuffle to next step">
          Shuffle
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" /></svg>
        </button>
      </div>
    </div>
  )
}

function MeetSolly() {
  const artRef = useRef<HTMLDivElement>(null)
  const sollyRef = useRef<HTMLDivElement>(null)
  const [faceIdx, setFaceIdx] = useState(0)
  const faces = [
    { file: 'solly-wink', alt: 'Solly winking' },
    { file: 'solly-sunglasses', alt: 'Solly wearing sunglasses' },
    { file: 'solly-sussy', alt: 'Solly grinning' },
    { file: 'solly-kiss', alt: 'Solly blowing a kiss' },
    { file: 'solly-tired', alt: 'Solly looking tired' },
    { file: 'solly-sad', alt: 'Solly looking sad' },
    { file: 'solly-gangster', alt: 'Solly looking tough' },
  ]

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setFaceIdx((i) => (i + 1) % faces.length), 2600)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let ticking = false
    function update() {
      ticking = false
      const el = sollyRef.current, section = artRef.current?.closest('section')
      if (!el || !section) return
      if (window.innerWidth <= 820 || reduce) { el.style.transform = ''; el.style.opacity = ''; return }
      const rect = section.getBoundingClientRect()
      let p = (window.innerHeight - rect.top) / (window.innerHeight + rect.height)
      p = Math.max(0, Math.min(1, p))
      const theta = (p - 0.5) * Math.PI
      const R = 132
      const dx = Math.cos(theta) * R
      const dy = -Math.sin(theta) * R
      const rot = (p - 0.5) * 22
      el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`
      el.style.opacity = Math.sin(p * Math.PI).toFixed(3)
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
    const offScroll = onAnyScroll(onScroll)
    window.addEventListener('resize', update)
    update()
    return () => { offScroll(); window.removeEventListener('resize', update) }
  }, [])

  return (
    <section className="meet" id="solly">
      <div className="container">
        <div className="meet-grid">
          <div className="meet-art" ref={artRef}>
            <div className="meet-solly" ref={sollyRef} role="img" aria-label="Solly the star mascot">
              <div className="solly-faces">
                {faces.map((f, i) => (
                  <img key={f.file} className={['face', i === faceIdx && 'on'].filter(Boolean).join(' ')} src={`/solly-landing/${f.file}.svg`} alt={f.alt} />
                ))}
              </div>
            </div>
          </div>
          <Reveal>
            <h2>Solly's the buddy who <em>remembers</em>.</h2>
            <div className="meet-list">
              {MEET_ITEMS.map((item) => (
                <div className="meet-item" key={item.title}>
                  <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{item.icon}</svg></div>
                  <div><h4>{item.title}</h4><p>{item.body}</p></div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function ChatDemo() {
  type ChatMsg = { who: 'them' | 'you'; text: string }
  const [messages, setMessages] = useState<ChatMsg[]>([{ who: 'them', text: "Hey! 👋 I'm Solly. What's something you've been wanting to do but keep putting off?" }])
  const [busy, setBusy] = useState(false)
  const [typing, setTyping] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight }, [messages, typing])

  useEffect(() => {
    return () => { if (replyTimerRef.current) clearTimeout(replyTimerRef.current) }
  }, [])

  function sendMsg(text: string) {
    const v = text.trim()
    if (!v || busy) return
    setBusy(true)
    setMessages((m) => [...m, { who: 'you', text: v }])
    setTyping(true)
    replyTimerRef.current = setTimeout(() => {
      setTyping(false)
      setMessages((m) => [...m, { who: 'them', text: replyFor(v) }])
      setBusy(false)
    }, 1050)
  }

  return (
    <div className="chat-shell" id="chat">
      <Reveal className="chat-card" as="div">
        <div className="chat-head">
          <img src="/solly-landing/Solly.png" alt="Solly" />
          <div style={{ flex: 1 }}><b>Solly</b><div className="stat">your goal buddy · online</div></div>
        </div>
        <div className="chat-body" ref={bodyRef}>
          {messages.map((m, i) => <div className={`msg ${m.who}`} key={i}>{m.text}</div>)}
          {typing && <div className="msg them typing"><i /><i /><i /></div>}
        </div>
        <div className="chat-suggest">
          {SUGGESTIONS.map((s) => <span key={s} onClick={() => sendMsg(s)}>{s}</span>)}
        </div>
        <div className="chat-foot">
          <input className="chat-input" placeholder="👆 Tap a prompt above to chat with Solly" readOnly tabIndex={-1} aria-readonly="true" autoComplete="off" />
          {/* prototype: send submits the input's value; the input is readonly
              (suggestion-chip driven), so clicking send is a guarded no-op */}
          <button className="chat-send" aria-label="Send" onClick={() => sendMsg('')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </Reveal>
    </div>
  )
}

function SollyHero() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [speechIdx, setSpeechIdx] = useState(0)
  const [bump, setBump] = useState(false)
  const [greeting, setGreeting] = useState(false)
  const playingRef = useRef(false)

  const greet = useCallback(() => {
    const video = videoRef.current
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (playingRef.current) return
    playingRef.current = true
    const START = 0.04, END = 4.0
    const go = () => {
      setGreeting(true)
      const pr = video.play()
      if (pr && pr.catch) pr.catch(() => {})
      const monitor = () => {
        if (!playingRef.current) return
        if (video.currentTime >= END || video.ended) {
          playingRef.current = false
          video.pause()
          setGreeting(false)
        } else requestAnimationFrame(monitor)
      }
      requestAnimationFrame(monitor)
    }
    if (Math.abs(video.currentTime - START) < 0.06) go()
    else {
      const onSeek = () => { video.removeEventListener('seeked', onSeek); go() }
      video.addEventListener('seeked', onSeek)
      try { video.currentTime = START } catch { go() }
    }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const kick = () => setTimeout(greet, 850)
    if (v.readyState >= 2) kick()
    else v.addEventListener('loadeddata', kick, { once: true })
  }, [greet])

  // prototype setupHero: the hero wrap has a .solly-clip, so isCanvas is true
  // and click only ever greets (hop belongs to the CTA Solly, not the hero)
  function onClick() {
    greet()
    setSpeechIdx((i) => (i + 1) % SPEECH.length)
    setBump(false)
    requestAnimationFrame(() => setBump(true))
    setTimeout(() => setBump(false), 280)
  }

  return (
    <div className="solly-stage">
      <div className="solly-glow" />
      <div className="speech s-main" dangerouslySetInnerHTML={{ __html: SPEECH[speechIdx] }} style={bump ? { transform: 'translateX(-50%) scale(1.09)' } : undefined} />
      <div
        className={['solly-hero-wrap', greeting && 'greeting'].filter(Boolean).join(' ')}
        ref={wrapRef}
        role="img" aria-label="Solly the star mascot, waving hello"
        onMouseEnter={greet}
        onClick={onClick}
      >
        <img className="solly-idle" src="/solly-landing/Solly.png" alt="Solly the star mascot" />
        <video ref={videoRef} className="solly-clip" src="/solly-landing/solly-greet.webm" muted playsInline preload="auto" aria-hidden="true" />
      </div>
    </div>
  )
}

// CTA Solly: jump on click; after idle, the idle clip plays (no clicks
// during); no hover shake — mirrors the prototype's CTA block.
function CtaSolly() {
  const svgHostRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hop, setHop] = useState(false)
  const [greeting, setGreeting] = useState(false)
  const idlePlayingRef = useRef(false)
  const scheduleRef = useRef<() => void>(() => {})

  useEffect(() => {
    const svg = svgHostRef.current?.querySelector('svg.solly-svg') as SVGSVGElement | null
    setupSollySvg(svg)
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const video = videoRef.current
    if (!wrap || !video) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let inView = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function playIdle() {
      if (idlePlayingRef.current || !inView) return
      idlePlayingRef.current = true
      setGreeting(true)
      try { video!.currentTime = 0.04 } catch { /* not loaded yet */ }
      const pr = video!.play()
      if (pr && pr.catch) pr.catch(() => {})
    }
    function schedule() {
      clearTimeout(timer)
      if (reduce || !inView) return
      timer = setTimeout(playIdle, 5200)
    }
    scheduleRef.current = schedule
    function onEnded() {
      video!.pause()
      idlePlayingRef.current = false
      setGreeting(false)
      schedule()
    }
    video.addEventListener('ended', onEnded)
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { inView = e.isIntersecting; if (inView) schedule(); else clearTimeout(timer) })
    }, { threshold: 0.4 })
    io.observe(wrap)
    return () => { io.disconnect(); video.removeEventListener('ended', onEnded); clearTimeout(timer) }
  }, [])

  function onClick() {
    if (idlePlayingRef.current) return
    setHop(false)
    requestAnimationFrame(() => setHop(true))
    scheduleRef.current()
  }

  return (
    <div
      className={['solly-hero-wrap', hop && 'hop', greeting && 'greeting'].filter(Boolean).join(' ')}
      ref={wrapRef} role="img" aria-label="Solly waving"
      onClick={onClick}
      onAnimationEnd={(e) => { if (e.animationName === 'gfl-sollyHop') setHop(false) }}
    >
      <video ref={videoRef} className="solly-clip" src="/solly-landing/solly-hero.webm" muted playsInline preload="auto" aria-hidden="true" />
      <div ref={svgHostRef} dangerouslySetInnerHTML={{ __html: CTA_SOLLY_SVG }} />
    </div>
  )
}

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem(THEME_KEY)
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => { document.title = "Solly — your goal-getting buddy · GoalForge" }, [])

  // prototype: html { scroll-behavior: smooth } — the app's scroller is <body>
  useEffect(() => {
    const prev = document.body.style.scrollBehavior
    document.body.style.scrollBehavior = 'smooth'
    return () => { document.body.style.scrollBehavior = prev }
  }, [])

  useEffect(() => {
    return onAnyScroll(() => setScrolled(getScrollY() > 12))
  }, [])

  // animated background — smooth scroll parallax (prototype's rAF loop)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const blobs = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('.bg-warm span') ?? [])
    if (!blobs.length) return
    const F = [0.14, -0.09, 0.20, -0.16, 0.07]
    const cur = blobs.map(() => 0)
    let raf = 0
    function frame() {
      const sy = getScrollY()
      for (let i = 0; i < blobs.length; i++) {
        const target = sy * (F[i] || 0.1)
        cur[i] += (target - cur[i]) * 0.08
        blobs[i].style.translate = '0px ' + cur[i].toFixed(1) + 'px'
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    function onResize() { if (window.innerWidth > 760) setNavOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setNavOpen(false) }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey) }
  }, [])

  function toggleTheme() {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(THEME_KEY, next)
      return next
    })
  }

  return (
    <div className="gfl-root" data-theme={theme} ref={rootRef}>
      <div className="bg-warm"><span className="w1" /><span className="w2" /><span className="w3" /><span className="w4" /><span className="w5" /></div>

      <div className="wrap">
        <nav className={['top', scrolled && 'scrolled'].filter(Boolean).join(' ')} id="nav">
          <div className="nav-in">
            <a className="logo" href="#top">GoalForge</a>
            <div className="nav-links">
              {NAV_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
            </div>
            <div className="nav-right">
              <button className="theme-btn" aria-label="Toggle theme" onClick={toggleTheme}>
                {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
              </button>
              <Show when="signed-out">
                <Link className="nav-signin" to="/sign-in">Sign in</Link>
                <Link className="btn-primary nav-cta" to="/sign-up">Let's plan</Link>
              </Show>
              <Show when="signed-in">
                <Link className="btn-primary nav-cta" to="/dashboard">Dashboard →</Link>
              </Show>
              <button className={['nav-burger', navOpen && 'open'].filter(Boolean).join(' ')} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen} aria-controls="navMenu" onClick={() => setNavOpen((v) => !v)}>
                <span /><span /><span />
              </button>
            </div>
          </div>
          <div className={['nav-menu', navOpen && 'open show'].filter(Boolean).join(' ')} id="navMenu">
            {NAV_LINKS.map((l) => <a key={l.href} className="m-link" href={l.href} onClick={() => setNavOpen(false)}>{l.label}</a>)}
            <Show when="signed-out">
              <Link className="m-link" to="/sign-in" onClick={() => setNavOpen(false)}>Sign in</Link>
              <Link className="btn-primary" to="/sign-up" onClick={() => setNavOpen(false)}>Let's plan</Link>
            </Show>
            <Show when="signed-in">
              <Link className="btn-primary" to="/dashboard" onClick={() => setNavOpen(false)}>Dashboard →</Link>
            </Show>
          </div>
        </nav>

        {/* HERO */}
        <header className="hero" id="top">
          <div className="container">
            <SollyHero />
            <h1 className="hero-title">Meet Solly — your <em>goal-getting</em> buddy.</h1>
            <p className="hero-sub">Tell Solly what you're trying to do. Together you'll break it into a friendly plan, knock out one small step a day, and actually keep the streak going — with a little encouragement whenever you need it.</p>
            <div className="hero-cta">
              <Show when="signed-out">
                <Link className="btn-primary btn-lg" to="/sign-up">Say hi to Solly</Link>
              </Show>
              <Show when="signed-in">
                <Link className="btn-primary btn-lg" to="/dashboard">Open Dashboard</Link>
              </Show>
              <a className="btn-ghost" href="#how">See how it works</a>
            </div>
            <div className="hero-meta">
              <span className="av">
                <i style={{ background: 'linear-gradient(135deg,var(--accent),var(--gold))' }} />
                <i style={{ background: 'linear-gradient(135deg,var(--green),var(--accent))' }} />
                <i style={{ background: 'linear-gradient(135deg,var(--indigo),var(--rose))' }} />
              </span>
              Join thousands turning "someday" into done.
            </div>
          </div>
          <div className="marquee">
            <div className="marquee-track">
              {[...PHRASES, ...PHRASES].map((p, i) => <span key={i}>{p}</span>)}
            </div>
          </div>
        </header>

        {/* CHAT */}
        <ChatDemo />

        {/* STATS */}
        <StatsBand />

        {/* HOW */}
        <section id="how">
          <div className="container">
            <Reveal>
              <div className="sec-eyebrow">How it works</div>
              <h2 className="sec-title">No willpower required. Just <em>show up</em> and chat.</h2>
            </Reveal>
            <HowItWorksDeck />
          </div>
        </section>

        {/* MEET SOLLY */}
        <MeetSolly />

        {/* STAGES */}
        <section id="stages">
          <div className="container">
            <Reveal>
              <div className="sec-eyebrow">The brightness system</div>
              <h2 className="sec-title">Your goal gets <em>brighter</em> every day you show up.</h2>
              <p className="sec-sub">Show up, check a task, keep the streak — and watch your goal climb from a faint Speck all the way to Celestial.</p>
            </Reveal>
            <Reveal className="journey" as="div">
              {STAGES.map((s) => (
                <div className="stage" key={s.name} style={{ '--c': s.c, '--sz': `${s.sz}px`, '--lvl': s.lvl } as React.CSSProperties}>
                  <div className="stage-star"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={STAR_SVG_PATH} /></svg></div>
                  <div className="stage-name">{s.name}</div>
                  <div className="stage-pts">{s.pts} pts</div>
                  <div className="stage-desc">{s.desc}</div>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* STORIES */}
        <section id="loved">
          <div className="container">
            <Reveal>
              <div className="sec-eyebrow">Real stories</div>
              <h2 className="sec-title">Goals that finally <em>stuck</em>.</h2>
            </Reveal>
            <div className="quotes">
              {QUOTES.map((q, i) => (
                <Reveal className="quote" delayIndex={i} key={q.name}>
                  <div className="stars">★★★★★</div>
                  <p>"{q.text}"</p>
                  <div className="who">
                    <div className="av" style={{ background: q.grad }} />
                    <div><b>{q.name}</b><span>{q.role}</span></div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="final" id="cta">
          <div className="container">
            <Reveal className="final-card" as="div">
              <CtaSolly />
              <h2>Ready when you are.<br />Let's plan <em>something good</em>.</h2>
              <p>Your first goal takes about a minute. Free to start, and Solly's here the whole way.</p>
              <div className="hero-cta">
                <Show when="signed-out">
                  <Link className="btn-primary btn-lg" to="/sign-up">Say hi to Solly</Link>
                </Show>
                <Show when="signed-in">
                  <Link className="btn-primary btn-lg" to="/dashboard">Open Dashboard</Link>
                </Show>
                <a className="btn-ghost" href="#how">How it works</a>
              </div>
            </Reveal>
          </div>
        </section>

        <footer>
          <div className="container">
            <div className="foot-in">
              <a className="logo" href="#top">GoalForge</a>
              <div className="foot-links">
                <a href="#chat">Chat</a>
                <a href="#how">How it works</a>
                <a href="#stages">Stages</a>
                <a href="#cta">Get started</a>
              </div>
            </div>
            <div className="foot-copy">© 2026 GoalForge · Big goals, one small step at a time — with Solly.</div>
          </div>
        </footer>
      </div>
    </div>
  )
}
