// Shared "where is the light + how bright is it right now" state. Hero writes
// the normalized intensity each r3f frame; top-bar UI components read both
// cursor position and intensity to compute their text color.
//
// No DOM blend modes — just plain color set via CSS variable. Avoids the
// per-channel color cast you get from mix-blend-mode: difference against a
// non-grayscale backdrop, and the visible rectangle from backdrop-filter.

export const lightProbe = {
  cursorX: -10000,
  cursorY: -10000,
  // 0..1, already includes scroll dim, intro fade, presence, and flame
  // flicker. Hero writes this each frame.
  intensity: 0,
};

let attached = false;
export function attachLightProbe() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener(
    "mousemove",
    (e) => {
      lightProbe.cursorX = e.clientX;
      lightProbe.cursorY = e.clientY;
    },
    { passive: true },
  );
}
