// Programmatic scroll to a section under `scroll-snap-type: y mandatory`.
// Mandatory snap on iOS Safari rejects scrollTop writes from non-zero
// positions and pulls back to the prior anchor. Workaround:
//   1. scroll-snap-type: none (so snap engine isn't active)
//   2. force a synchronous reflow (commit the style change before the
//      scroll, not just queue it)
//   3. set scrollTop directly
//   4. restore mandatory snap after 250ms — long enough for iOS to
//      observe the new position and adopt it as the new snap anchor
//
// Pass an element id to scroll to its offsetTop, or null for the top.
export function scrollToSection(id: string | null): void {
  const el = id ? document.getElementById(id) : null;
  const html = document.documentElement;
  // Absolute document offset — NOT el.offsetTop. offsetTop is relative to the
  // nearest positioned ancestor: the project steps live inside a
  // position:relative `.projects` wrapper, so step-NN.offsetTop is ~1700px
  // short of the real scroll target (top-level sections like #prefinal /
  // #about happen to work only because their offsetParent is <body>).
  // rect.top + current scrollTop is the true target for both cases, so
  // footer/nav deep-links to #step-NN land correctly.
  const top = el
    ? Math.round(el.getBoundingClientRect().top + html.scrollTop)
    : 0;
  const prev = html.style.scrollSnapType;
  html.style.scrollSnapType = "none";
  void html.offsetHeight; // force reflow
  html.scrollTop = top;
  setTimeout(() => {
    html.style.scrollSnapType = prev;
  }, 250);
}
