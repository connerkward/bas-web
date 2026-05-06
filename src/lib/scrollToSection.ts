// Programmatically scroll to a section under `scroll-snap-type: y mandatory`
// on `html`. Mandatory snap on iOS Safari rejects programmatic scroll
// position changes from a non-zero scrollY, snapping the page back to the
// previous anchor. The fix that holds:
//   1. Set `scroll-snap-type: none` BEFORE the scroll (snap can't fight
//      what isn't active).
//   2. Force a synchronous reflow so the style change is committed, not
//      just queued in the next batch.
//   3. Set scrollTop directly (not scrollIntoView, not scrollTo with
//      smooth — both race with snap and global scroll-behavior).
//   4. Restore mandatory snap after a long-enough delay (200ms) for iOS
//      to observe the new position and adopt it as the new anchor. Too
//      short and iOS pulls back to the OLD anchor on restore.
//
// Pass an element id; we look it up and scroll its `offsetTop`. Pass
// nothing or null to scroll to the top.
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
  }, 200);
}
