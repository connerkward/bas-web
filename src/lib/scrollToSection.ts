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
  const top = el ? el.offsetTop : 0;
  const html = document.documentElement;
  const prev = html.style.scrollSnapType;
  html.style.scrollSnapType = "none";
  void html.offsetHeight; // force reflow
  html.scrollTop = top;
  setTimeout(() => {
    html.style.scrollSnapType = prev;
  }, 250);
}
