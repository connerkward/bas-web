# CLAUDE.md — load-bearing architecture notes

For future-Claude: things that look weird in the code but exist for a real reason. **Do not "simplify" these without testing on a real iPhone.** Every one of these notes corresponds to a multi-iteration debugging cycle that landed here for a specific reason.

---

## Scroll snap and nav (the long one)

The page is a full-page snap site: hero, prefinal (Studies in Motion), six project steps, footer. Each section is exactly `100lvh`. The nav has Logo (back to top), PROJECT (→ #prefinal), ABOUT (→ #about). Each project step has its own `id="step-01"` … `id="step-06"` for direct linking.

### The setup that works

- **`scroll-snap-type: y mandatory`** on `html` (in `src/index.css`).
- **`scroll-snap-align: start`** on every `.page__section` and `.step`.
- **All programmatic navigation goes through `src/lib/scrollToSection.ts`** — TopNav clicks, Logo click, App's `hashchange` listener.

### Why mandatory CSS snap (and not proximity, and not JS)

- **Proximity** doesn't snap firmly enough. Touch swipes feel loose. User tested, rejected.
- **JS-driven snap on scroll-end** ("after the user stops scrolling, smooth-scroll to the nearest viewport multiple") feels like a spinner with momentum then a sudden pop into place. Not native card-swipe. User tested, rejected.
- **Mandatory CSS snap** gives the native iOS card-swipe feel — instant snap during the swipe, no momentum-then-pop. This is the only acceptable feel.

### Why `scrollToSection.ts` exists

iOS Safari has a long-standing bug: with `scroll-snap-type: y mandatory` on `html`, programmatic scroll position changes (`scrollTop = X`, `scrollIntoView`, etc.) from a non-zero scrollY get pulled back to the prior snap anchor. Tap PROJECT from step-03 → page tries to scroll to prefinal → snap engine yanks back to step-03. This bug works fine from `scrollY = 0` (no prior anchor to fight) and works fine in Chrome, Playwright Chromium, even Playwright WebKit. **Only reproduces on real mobile Safari.**

The documented workaround (which is what `scrollToSection.ts` does):

```ts
html.style.scrollSnapType = "none";
void html.offsetHeight;            // force reflow — commit the style change
html.scrollTop = el.offsetTop;     // direct scrollTop, not scrollIntoView/smooth
setTimeout(() => {
  html.style.scrollSnapType = prev;  // restore mandatory
}, 250);
```

The `250ms` is the floor. Shorter delays (rAF, 80ms, 200ms — all tried) let iOS re-anchor to the prior snap point. 250ms is empirically enough for iOS to observe the new scroll position and adopt it as the new snap anchor.

### Things tried and rejected

| Approach | Why it failed |
|---|---|
| `<a href="#id">` plain anchor with mandatory snap | iOS Safari bug — pulls back from non-zero scrollY |
| `scroll-snap-type: y proximity` | Doesn't snap firmly enough; user rejected |
| Touch-only proximity (`@media (hover: none)`) | Same as above |
| `scroll-snap-stop: always` | With `proximity`, didn't help. With `mandatory`, no effect on the bug |
| `scrollIntoView({ behavior: "smooth" \| "instant" })` | Snap engine cancels/redirects mid-scroll on iOS |
| JS snap (no CSS scroll-snap) | "Spinner momentum" feel — user rejected |
| `transform: translateZ(0)` / `will-change` on links to force own paint layer | Patches the wrong thing; doesn't address the snap engine |
| Native `addEventListener('click')` via ref instead of React `onClick` | Doesn't matter — React's synthetic events fire reliably here |
| `touch-action: manipulation` on links | Defensive for double-tap-zoom — irrelevant to the snap bug |

### Architecture: topbar split into TWO fixed elements

`src/App.tsx` renders `<div className="topbar-left">` and `<nav className="topbar-right">` as **two separate fixed elements** (logo on the left, nav on the right). NOT one wrapper `<header>`.

Why: a single full-width `<header className="topbar">` with `mix-blend-mode: difference` on it required `pointer-events: none` on the wrapper (so scroll/clicks could pass through the empty middle), with `pointer-events: auto` re-enabled on children. iOS Safari has a hit-testing bug on that combination — taps on `<a>` descendants of a `mix-blend-mode + pointer-events:none` parent get dropped entirely.

Splitting into two independently-positioned elements means:
- The empty middle has zero DOM, no `pointer-events:none` trick needed.
- Each element has `mix-blend-mode: difference` independently — the "entire header has the blend" semantic is preserved.
- Nav clickables aren't descendants of any blend layer.

### Logo is a `<button>`, not `<a href="/">`

`<a href="/">` does a full-page reload (same URL, same path = navigation event). Browser scroll-restoration after the reload then puts the user back on the scroll position they had before the reload (= the project step they were on). Symptom: "click home → stays on PLAN IN SOFTWARE."

`<button>` with `onClick={() => scrollToSection(null)}` doesn't navigate, doesn't reload, doesn't trigger scroll-restoration.

### URL hash policy

- Hash only changes when the USER changes it — nav-link click handler writes `replaceState(null, "", "#id")`, URL bar edit fires `hashchange` natively.
- **No active-section → URL mirror.** A previous version mirrored the IO-derived `active` section into the URL on every scroll. Result: editing the URL bar from `/#about` to `/` got immediately overwritten back to `/#about` because the IO still saw the footer in view. The user's URL intent must win.
- App.tsx's `hashchange` listener calls `scrollToSection(id || null)` so URL-bar edits and back/forward actually scroll the page.

---

## Footer BAS letter animation

Per-letter cascade on desktop (`min-width: 721px`), parent-element opacity fade on mobile (`max-width: 720px`).

### Why split

The `.footer__bas` wordmark uses IntraNet at huge sizes (~135px on phone). IntraNet's actual ascender extends past its line-box typographic ascender. iOS Safari hardware-accelerates ANY per-element animation (opacity, color, transform) onto a compositor layer **sized to the element's box** — and for an inline `<span>`, that box is the tight line-box. So per-letter animation = per-letter compositor layer = clipped ascender.

- Desktop: per-letter animation. Compositor layers per letter, but desktop browsers don't have the ascender-clip issue. Cascade visual works.
- Mobile: animate the parent `.footer__bas` (opacity 0 → 1). One compositor layer, sized to the parent's padded box (which has `padding-top: 0.6em` headroom). Ascender stays inside the layer.

### Why color → color, not opacity

For the desktop cascade, animation is `color: --footer-bg → --footer-display` (both fully opaque). NOT `opacity: 0 → 1`, NOT `color: transparent → display`.

- Opacity → compositor layer per letter → clip.
- `transparent → display` interpolates the alpha channel; at low alpha, anti-aliased edges read as zero contrast and the glyph appears thin.
- `bg-color → display-color` is RGB-only interpolation, both endpoints fully opaque — every pixel paints at 100% coverage from frame 0, just invisible-by-tone-match initially.

---

## Section heights are `100lvh`, not `100dvh`

iOS Safari's URL bar collapses on scroll. With `100dvh`, every section's height recomputes as the URL bar transitions, which **shifts the snap-target offsets** under mandatory snap. Every snap point moves under the user's finger → mandatory snap pulls them to the new "nearest" target → visible jump (worst at the footer, where the user comes to rest).

`100lvh` is fixed at the URL-bar-collapsed viewport — never changes during the URL bar transition. Snap targets sit at stable absolute offsets.

Trade-off: when the URL bar IS visible, the bottom ~80px of each snapped section sits below the visible viewport. Acceptable because `scroll-snap-align: start` anchors the section TOP, and the hidden 80px is the start of the next section anyway.

---

## Font: WOFF2 first, OTF fallback

`src/index.css` declares `src: url("/fonts/IntraNet.woff2"), url("/fonts/IntraNet.otf")`.

The repo has both formats. The previous WOFF2 was a broken subset (R glyph mis-sized) and the codebase explicitly fell back to OTF — but iOS Safari renders OTF through its CFF rasterizer at large sizes with visible tonal banding at glyph tops. Fix: regenerated a full unsubsetted WOFF2 from the OTF (`fontTools` with `flavor='woff2'`, no glyph subsetting). WOFF2 goes through Safari's standard TTF/OTF table renderer, no banding.

---

## Per-step reveal cascade

`src/components/Projects.tsx` has a `useReveal()` hook that fires once per step on first IntersectionObserver entry (`threshold: 0.25`), then disconnects. Adds a `step--in` class. CSS in `src/App.css` (the "reveal cascade" block) animates head → display → blurb → media in sequence with a 700ms cubic-bezier and per-element delays via inline `style={{ "--d": "150ms" }}`.

Step 06 (finale) has its own `step--finale-in` cascade — the per-step reveal selectors all use `:not(.step--finale)` so the two systems don't double-bind.

---

## Two top-of-file index.css notes

- `<body class="in-hero">` ships in `index.html` so the very first paint is in the hero state. Without it, the topbar-tinted CSS rule briefly resolves `--topbar-color` to the orange tint between first paint and the Hero effect mount, fading from orange to white in the user's face.
- `overscroll-behavior-y: none` on `html` kills the rubber-band overscroll past the document end. Otherwise iOS Safari's elastic past-the-footer pull collides with mandatory snap.

---

## Common landmines for future-Claude

1. **Don't add CSS scroll-snap rules without going through `scrollToSection.ts`.** Any new programmatic scroll path (e.g., a "scroll to top after form submit") must use the helper or it will hit the iOS bug.
2. **Don't change the topbar back to one wrapper element** unless you've verified taps still work on real iOS Safari (not Chromium emulation).
3. **Don't switch the footer BAS animation to per-letter on mobile.** It will reintroduce the ascender clip.
4. **Don't add `behavior: "smooth"`** to anything that needs to land at an exact position on iOS — smooth scrolls race with mandatory snap. Use the `scrollToSection` helper which uses direct `scrollTop`.
5. **Don't run Playwright Chromium and assume iOS Safari behaves the same.** It doesn't. Use real iPhone (via iPhone Mirroring + computer-use, or via `ios-webkit-debug-proxy` + USB) for any nav/snap/touch behavior verification.

---

## File map of nav/snap concerns

- `src/index.css` — `scroll-snap-type: y mandatory`, `overscroll-behavior-y: none`.
- `src/App.css` — `.page__section { height: 100lvh; scroll-snap-align: start }`, `.step { scroll-snap-align: start }`, all the topbar split CSS (`.topbar-left`, `.topbar-right`).
- `src/lib/scrollToSection.ts` — the snap-disable + scrollTop + 250ms restore helper. Single source of truth for programmatic nav.
- `src/components/TopNav.tsx` — PROJECT/ABOUT links with `onClick → scrollToSection(target)`.
- `src/components/Logo.tsx` — `<button>` (not `<a>`) with `onClick → scrollToSection(null)`.
- `src/App.tsx` — two fixed `<div className="topbar-left">` + `<nav className="topbar-right">`, plus the `hashchange` listener that routes URL-bar edits through `scrollToSection`.
- `src/components/Projects.tsx` — `id="step-NN"` on each step section for direct linking.
