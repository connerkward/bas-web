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

      // Fast-path: nothing to do if the light is off and our text already
      // settled at white.
      if (
        lightProbe.intensity < STABLE_EPS &&
        state.current < STABLE_EPS &&
        state.lastWritten === 0
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

      // Text color stays white — let mix-blend-mode: difference do all the
      // chromatic work. No warm-cream lerp, no per-channel matching tricks.
      // The "difference effect" intensifies naturally as the lit bg gets
      // brighter and pulls the inverted text further from white. Stroke
      // still scales below to add the subtle weight gain we want.
      if (state.lastWritten !== 1) {
        state.lastWritten = 1;
        el.style.setProperty("--topbar-color", "rgb(255, 255, 255)");
      }
    };

    return subscribe({ tick });
  }, []);

  return ref;
}
