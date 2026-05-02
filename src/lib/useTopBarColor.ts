import { useEffect, useRef } from "react";
import { lightProbe } from "./lightProbe";

// Trigger zone for "spotlight is over the logo" — a fraction of the viewport
// diagonal, with a px floor for small windows.
const RADIUS_FRAC = 0.32;
const RADIUS_MIN_PX = 280;
// Boost on (proximity × intensity) before clamp. ~1.8 means cursor doesn't
// have to be dead-center to fully saturate, but doesn't trigger from far away.
const LIT_BOOST = 1.8;
// Smoothing rate for color toward target each frame.
const LERP = 0.2;

export function useTopBarColor<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    let raf = 0;
    let current = 0;
    let radius = 800;

    const updateRadius = () => {
      const diag = Math.hypot(window.innerWidth, window.innerHeight);
      radius = Math.max(RADIUS_MIN_PX, diag * RADIUS_FRAC);
    };
    updateRadius();
    window.addEventListener("resize", updateRadius);

    const tick = () => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = lightProbe.cursorX - cx;
        const dy = lightProbe.cursorY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Smoothstep falloff — soft transition from full at center to none
        // past the radius.
        const t = Math.min(1, Math.max(0, 1 - dist / radius));
        const proximity = t * t * (3 - 2 * t);
        const target = Math.min(
          1,
          proximity * lightProbe.intensity * LIT_BOOST,
        );
        current += (target - current) * LERP;
        const v = Math.round((1 - current) * 255);
        el.style.setProperty("--topbar-color", `rgb(${v}, ${v}, ${v})`);
        // Subtle stroke weight that scales with lit factor — text gets a bit
        // chunkier as it transitions to black. Capped low so it never reads
        // as a different weight, just slightly heavier.
        el.style.setProperty(
          "--topbar-stroke",
          `${(current * 0.5).toFixed(2)}px`,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateRadius);
    };
  }, []);

  return ref;
}
