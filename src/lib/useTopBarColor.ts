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
        // Lerp text color from white toward the warm-cream lit color
        // (#d4ad6f — stone × light × ACES peak). With mix-blend-mode:
        // difference active on .topbar in classic mode:
        //   - Far from torch (text=white, bg=dark): diff ≈ white → visible
        //   - Near torch (text=warm-cream, bg=warm-lit): diff ≈ black →
        //     visible silhouette (difference cancels matching colors).
        // This produces the f807fca "approach turns black" feel while
        // actually using difference to do the work — fading text to literal
        // rgb(0,0,0) instead would dissolve into the bg via diff identity.
        const c = state.current;
        const r = 255 - Math.round((255 - 0xd4) * c);
        const g = 255 - Math.round((255 - 0xad) * c);
        const b = 255 - Math.round((255 - 0x6f) * c);
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
