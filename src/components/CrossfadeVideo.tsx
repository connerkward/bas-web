import { useEffect, useRef } from "react";

// Two stacked <video> elements with opacity-driven crossfade at the loop
// boundary. Native loop=true restarts abruptly on a 1-frame seek; this
// dissolves into a fresh playback so the seam never reads. Only one video
// is decoding at a time except during the fade window. Used by both the
// prefinal hero and the installation finale.
export default function CrossfadeVideo({
  src,
  fadeSec = 0.6,
  className,
}: {
  src: string;
  fadeSec?: number;
  className?: string;
}) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    a.style.opacity = "1";
    b.style.opacity = "0";
    const trans = `opacity ${fadeSec}s linear`;
    a.style.transition = trans;
    b.style.transition = trans;
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
    return () => cancelAnimationFrame(raf);
  }, [src, fadeSec]);

  return (
    <div className={className} aria-hidden="true">
      <video
        ref={aRef}
        className="crossfade-clip"
        src={src}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
      <video
        ref={bRef}
        className="crossfade-clip"
        src={src}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
    </div>
  );
}
