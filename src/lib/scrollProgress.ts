// Shared scroll progress (0 = top, 1 = fully scrolled). Module-level ref so
// any component (including r3f) can read without prop drilling or context.
//
// The actual scroll container is `.page` (a fixed inner div), not the
// document — see App.css. Tracks that element's scrollTop / scrollHeight.
// Falls back to window scroll if `.page` is missing (e.g. before mount).
const ref = { current: 0 };
let attached = false;
let container: HTMLElement | null = null;

function recompute() {
  if (container) {
    const max = container.scrollHeight - container.clientHeight;
    ref.current =
      max > 0 ? Math.min(1, Math.max(0, container.scrollTop / max)) : 0;
    return;
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  ref.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

export function attachScrollProgress() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  // Find the scroll container. If it isn't mounted yet, retry shortly.
  const find = () => {
    container = document.querySelector(".page") as HTMLElement | null;
    if (!container) {
      requestAnimationFrame(find);
      return;
    }
    container.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);
    recompute();
  };
  find();
}

export const scrollProgress = ref;
