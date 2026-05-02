// Heuristic initial DPR. Mid-range laptops get full DPR; weak / battery-saving
// devices get downsampled. The debug slider lets you override at runtime.
export function detectInitialDpr(): number {
  if (typeof window === "undefined") return 1;
  const cores = navigator.hardwareConcurrency ?? 4;
  const devicePr = Math.min(window.devicePixelRatio ?? 1, 2);
  if (cores >= 8) return Math.min(devicePr, 2);
  if (cores >= 4) return Math.min(devicePr, 1.25);
  return 0.75;
}
