import { useEffect, useRef, useState } from "react";
import { posterFor } from "../lib/posterFor";

// Two stacked <video> elements with opacity-driven crossfade at the loop
// boundary. Native loop=true restarts abruptly on a 1-frame seek; this
// dissolves into a fresh playback so the seam never reads. Only one video
// is decoding at a time except during the fade window. Used by both the
// prefinal hero and the installation finale.
//
// Playback is gated on BOTH `play` (caller's reveal flag) AND the element's
// own viewport visibility (internal IntersectionObserver) — so the finale's
// clip isn't decoding from page load while it's far below the fold. This
// matters on iOS / in-app webviews that cap concurrent video decoding.
// `preload` defaults to "none" (lazy); the prefinal "runner" passes "auto"
// so it loads with preference ahead of the lazy clips. A poster (first-frame
// still) shows until the video has data.
export default function CrossfadeVideo({
  src,
  fadeSec = 0.6,
  className,
  play = true,
  preload = "none",
}: {
  src: string;
  fadeSec?: number;
  className?: string;
  play?: boolean;
  preload?: "none" | "metadata" | "auto";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const poster = posterFor(src);

  // Track viewport visibility; pre-roll slightly before entry.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px", threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    a.style.opacity = "1";
    b.style.opacity = "0";
    const trans = `opacity ${fadeSec}s linear`;
    a.style.transition = trans;
    b.style.transition = trans;
    if (!(play && inView)) {
      a.pause();
      b.pause();
      return;
    }
    a.play().catch(() => {});

    let active: "a" | "b" = "a";
    let raf = 0;
    const tick = () => {
      const cur = active === "a" ? a : b;
      const next = active === "a" ? b : a;
      if (
        cur.duration &&
        cur.duration - cur.currentTime <= fadeSec &&
        next.paused
      ) {
        next.currentTime = 0;
        next.play().catch(() => {});
        cur.style.opacity = "0";
        next.style.opacity = "1";
        const outgoing = cur;
        window.setTimeout(() => outgoing.pause(), fadeSec * 1000 + 50);
        active = active === "a" ? "b" : "a";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      b.pause();
    };
  }, [src, fadeSec, play, inView]);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <video
        ref={aRef}
        className="crossfade-clip"
        src={src}
        poster={poster}
        muted
        playsInline
        preload={preload}
        disablePictureInPicture
      />
      <video
        ref={bRef}
        className="crossfade-clip"
        src={src}
        poster={poster}
        muted
        playsInline
        preload={preload}
        disablePictureInPicture
      />
    </div>
  );
}
