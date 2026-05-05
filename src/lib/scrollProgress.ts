// Shared scroll progress (0 = top, 1 = fully scrolled). Module-level ref so
// any component (including r3f) can read without prop drilling or context.
//
// Document is the scroll container (standard full-page snap pattern). Tracks
// window.scrollY against documentElement.scrollHeight.
const ref = { current: 0 };
let attached = false;

function recompute() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  ref.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

export function attachScrollProgress() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("scroll", recompute, { passive: true });
  window.addEventListener("resize", recompute);
  recompute();
}

export const scrollProgress = ref;
