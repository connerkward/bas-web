import { useEffect, useRef, useState, type CSSProperties } from "react";

const PREFINAL_VIDEO = "/videos/prefinal.mp4";
// Seconds. Long enough to read as a deliberate dissolve at this video's
// pace; short enough that a viewer rarely catches both copies on screen.
const CROSSFADE_SEC = 0.6;

// Two stacked <video> elements with opacity-driven crossfade at the loop
// boundary. Native loop=true restarts abruptly on a 1-frame seek; this
// dissolves into a fresh playback so the seam never reads. Only one video
// is decoding at a time except during the fade window.
function CrossfadeVideo({ src }: { src: string }) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    a.style.opacity = "1";
    b.style.opacity = "0";
    const trans = `opacity ${CROSSFADE_SEC}s linear`;
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
        cur.duration - cur.currentTime <= CROSSFADE_SEC &&
        next.paused
      ) {
        next.currentTime = 0;
        next.play().catch(() => {});
        cur.style.opacity = "0";
        next.style.opacity = "1";
        // Pause the outgoing one once it's invisible, so we're back to a
        // single decode until the next handoff.
        const outgoing = cur;
        window.setTimeout(
          () => outgoing.pause(),
          CROSSFADE_SEC * 1000 + 50,
        );
        active = active === "a" ? "b" : "a";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src]);

  return (
    <div className="prefinal__video" aria-hidden="true">
      <video
        ref={aRef}
        className="prefinal__video-clip"
        src={src}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
      <video
        ref={bRef}
        className="prefinal__video-clip"
        src={src}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
    </div>
  );
}

// Inline `--d` (transition delay) per child so the reveal cascade reads
// like a sequenced beat: meta → STUDIES → IN MOTION → body → def → video.
const D = (ms: number): CSSProperties => ({ ["--d" as never]: `${ms}ms` });

export default function Prefinal() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const root = document.querySelector(".page");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.35, root },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`prefinal${revealed ? " prefinal--in" : ""}`}>
      <CrossfadeVideo src={PREFINAL_VIDEO} />

      <div className="prefinal__copy">
        <p className="prefinal__meta" style={D(0)}>
          <span className="prefinal__meta-label">INSTALLED</span>
          <span className="prefinal__meta-detail">
            GRAY AREA GRAND THEATER · BYOB · APRIL 7
          </span>
        </p>
        <h2 className="prefinal__title">
          <span
            className="prefinal__title-line prefinal__title-line--studies"
            style={D(120)}
          >
            STUDY
          </span>
          <span
            className="prefinal__title-line prefinal__title-line--motion"
            style={D(280)}
          >
            IN MOTION.
          </span>
        </h2>
        <p className="prefinal__body" style={D(520)}>
          A single body, photographed in profile, broken across depth and
          projected back onto milled relief. The piece is a chronophotograph
          held in one frame — Marey's interval, Muybridge's stride — rendered
          as surface and light.
        </p>
        <p className="prefinal__def" style={D(720)}>
          <span className="prefinal__def-head">
            <span className="prefinal__def-term">chronophotography</span>
            <span className="prefinal__def-pos">n.</span>
          </span>
          <span className="prefinal__def-text">
            a sequence of photographs taken at fixed intervals to record a
            body in motion. Étienne-Jules Marey, 1882.
          </span>
        </p>
      </div>
    </div>
  );
}
