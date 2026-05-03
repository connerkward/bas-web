import { useEffect, useRef } from "react";
import { lightProbe } from "./lightProbe";

const RADIUS_FRAC = 0.32;
const RADIUS_MIN_PX = 280;
const LIT_BOOST = 1.8;
const LERP = 0.2;

// Below these thresholds nothing visibly moves; we can skip the per-frame
// DOM read/write entirely.
const STABLE_EPS = 0.0008;

// One shared rAF loop for all subscribers — saves scheduling N callbacks per
// frame.
type Subscriber = { tick: () => void };
const subscribers = new Set<Subscriber>();
let raf = 0;

function loop() {
  subscribers.forEach((s) => s.tick());
  if (subscribers.size > 0) raf = requestAnimationFrame(loop);
  else raf = 0;
}
function ensureRunning() {
  if (raf === 0 && subscribers.size > 0) raf = requestAnimationFrame(loop);
}
function subscribe(s: Subscriber) {
  subscribers.add(s);
  ensureRunning();
  return () => {
    subscribers.delete(s);
  };
}

let cachedRadius = 800;
let radiusInited = false;
function updateRadius() {
  const diag = Math.hypot(window.innerWidth, window.innerHeight);
  cachedRadius = Math.max(RADIUS_MIN_PX, diag * RADIUS_FRAC);
}

export function useTopBarColor<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!radiusInited) {
      updateRadius();
      window.addEventListener("resize", updateRadius);
      radiusInited = true;
    }

    const state = {
      current: 0,
      lastWritten: -1,
    };

    const tick = () => {
      const el = ref.current;
      if (!el) return;

      // Out of hero, the hook has nothing to drive (no torch, no diff blend)
      // — let the CSS cascade own --topbar-color so debug tints / future
      // section-scoped colorways can apply. Strip any leftover inline values.
      if (!document.body.classList.contains("in-hero")) {
        if (state.lastWritten !== 0) {
          el.style.removeProperty("--topbar-color");
          el.style.removeProperty("--topbar-stroke");
          state.current = 0;
          state.lastWritten = 0;
        }
        return;
      }

      const classic = lightProbe.headerClassic;

      // Fast-path: nothing to do if the light is off and our text already
      // settled at the right resting state.
      if (
        lightProbe.intensity < STABLE_EPS &&
        state.current < STABLE_EPS &&
        state.lastWritten === (classic ? 2 : 1)
      ) {
        return;
      }

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = lightProbe.cursorX - cx;
      const dy = lightProbe.cursorY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(1, Math.max(0, 1 - dist / cachedRadius));
      const proximity = t * t * (3 - 2 * t);
      const target = Math.min(
        1,
        proximity * lightProbe.intensity * LIT_BOOST,
      );
      state.current += (target - state.current) * LERP;

      if (classic) {
        // Lerp text color from white toward a saturated dark warm tone
        // (#5a3818). This sits below the peak lit-bg (~#825028) at roughly
        // the median bg under a letter footprint, so the difference math
        // produces near-black across more of the silhouette area instead
        // of only at the single brightest pixel. Trade-off: the absolute
        // brightest spot lands at a small warm residual instead of perfect
        // black, but the overall letter reads as a darker silhouette —
        // which is what we want.
        const c = state.current;
        const r = 255 - Math.round((255 - 0x5a) * c);
        const g = 255 - Math.round((255 - 0x38) * c);
        const b = 255 - Math.round((255 - 0x18) * c);
        el.style.setProperty("--topbar-color", `rgb(${r}, ${g}, ${b})`);
        el.style.setProperty(
          "--topbar-stroke",
          `${(c * 0.5).toFixed(2)}px`,
        );
        state.lastWritten = 2;
      } else {
        // Default: text stays white — mix-blend-mode: difference does the
        // chromatic work, intensifying as the lit bg gets brighter.
        if (state.lastWritten !== 1) {
          state.lastWritten = 1;
          el.style.setProperty("--topbar-color", "rgb(255, 255, 255)");
          el.style.setProperty("--topbar-stroke", "0px");
        }
      }
    };

    return subscribe({ tick });
  }, []);

  return ref;
}
