import { useEffect, useRef } from "react";

// Play a muted inline <video> only while it's in/near the viewport; pause it
// otherwise. iOS — and especially in-app webviews like Instagram/Facebook —
// cap how many <video> elements can decode at once. With every clip set to
// `autoplay`, the browser tries to start them all on load and only the first
// few ever play (the rest stay on their poster / go black). Gating playback on
// visibility keeps just the on-screen clip(s) decoding, so each one plays as
// you scroll to it. `rootMargin` pre-rolls the clip slightly before it enters.
export function usePlayInView(rootMargin = "200px") {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // play() can reject (e.g. interrupted by a pause); ignore.
          void v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [rootMargin]);
  return ref;
}
