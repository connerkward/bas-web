import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// JS-driven snap. Replaces CSS scroll-snap-type, which fought either
// programmatic nav (mandatory) or felt loose (proximity) on iOS Safari.
// After scrolling stops for ~120ms, if the user landed mid-section,
// smooth-scroll to the nearest viewport boundary. Click-nav (which
// lands on exact viewport multiples) skips re-snap because it's
// already aligned. Reduced-motion users skip the snap entirely.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let timer: number | undefined;
  let snapping = false;
  const onScroll = () => {
    if (snapping) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const h = window.innerHeight;
      const target = Math.round(window.scrollY / h) * h;
      if (Math.abs(target - window.scrollY) > 8) {
        snapping = true;
        window.scrollTo({ top: target, behavior: "smooth" });
        // Release the lock after the smooth scroll could plausibly
        // finish — long enough not to ping-pong, short enough that a
        // user gesture during the scroll re-arms quickly.
        window.setTimeout(() => { snapping = false; }, 600);
      }
    }, 120);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
