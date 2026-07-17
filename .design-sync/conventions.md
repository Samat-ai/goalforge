# GoalForge conventions

GoalForge is a deep-space, dark-first design language: warm accent orange on near-black indigo, generous card radii, three brand typefaces. Fourteen presentational components ship on `window.GoalForge`; everything else you compose yourself with the tokens below.

## Root wrapper — required

Wrap every screen in `<div className="gf-root">`. It carries the page's radial deep-space background, body font (`--font-body`), text color, and visible keyboard-focus rings. Without it you get a white page with mismatched type. Dark is the default; opt into light mode by ALSO setting `data-theme="light"` on the `<html>` element (not on `.gf-root`).

```jsx
<div className="gf-root" style={{ minHeight: '100vh', padding: 24 }}>
  {/* screen content */}
</div>
```

## Styling idiom — CSS custom properties, defined at `:root`

Style your own layout glue with these tokens (all defined in the shipped stylesheet; never hardcode hex):

- Surfaces: `--bg` page · `--card` raised card · `--card-2` inner/nested surface
- Lines: `--border` default · `--border-hi` emphasized
- Text: `--text` primary · `--text-mute` secondary/captions
- Semantic color: `--accent` (warm orange — primary actions, streaks) · `--gold` (rewards/stars) · `--indigo` (Solly/AI moments) · `--green` (success) · `--rose` (danger/alerts)
- Type: `--font-display` (Space Grotesk — headings) · `--font-body` (Hanken Grotesk) · `--font-mono` (JetBrains Mono — stats, chips, labels)

Card surface recipe used everywhere: `background: var(--card); border: 1px solid var(--border); border-radius: 14px;` (up to 20px for hero cards).

Reusable shipped classes (use these before inventing): `.gf-h1` `.gf-h2` display headings · `.gf-eyebrow` small-caps kicker · `.gf-chip` (+ `.gf-chip-ok` `.gf-chip-gold` `.gf-chip-flame` `.gf-chip-over` `.gf-chip-soon`) status chips · `.gf-btn-accent` primary button · `.gf-btn-soft` secondary · `.gf-btn-ghost-accent` ghost CTA · `.gf-btn-pill` pill button · `.gf-btn-danger` destructive.

## Where the truth lives

Read `styles.css` → `_ds_bundle.css` (the app's full compiled stylesheet — tokens at `:root`, every `gf-*` class) before styling anything. Per-component API is in `components/<group>/<Name>/<Name>.d.ts`, usage in the matching `.prompt.md`.

## Component notes

- `Icon` takes a `name` from the built-in registry (e.g. `spark flame target check trophy bolt heart book run brain clock gear chart chat moon sun pencil refresh x plus`); unknown names render empty.
- `Ring` animates on mount; pass `fromRatio={1}` for a statically-pinned ring.
- `Reveal` plays a one-time staggered entrance per mount; `Switcher` cross-fades content when its `value` changes — don't nest one entrance system inside the other.
- `RewardModal` / `CollectionModal` are fixed full-viewport overlays (portal-free) — render them at the top level of the screen.

## Idiomatic example (verified render)

```jsx
<div className="gf-root" style={{ minHeight: '100vh', padding: 24 }}>
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 26, maxWidth: 460 }}>
    <GoalForge.Ring value={0.72} fromRatio={1}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>72%</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>this sprint</div>
      </div>
    </GoalForge.Ring>
    <div>
      <div className="gf-eyebrow">Current sprint</div>
      <div className="gf-h2">Run a 5K</div>
      <span className="gf-chip gf-chip-flame"><GoalForge.Icon name="flame" size={10} /> 12d streak</span>
    </div>
  </div>
</div>
```
