import { useEffect, useRef, useState, type CSSProperties } from "react";
import CrossfadeVideo from "./CrossfadeVideo";

const PREFINAL_VIDEO = "/videos/prefinal.mp4";

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
      <CrossfadeVideo
        src={PREFINAL_VIDEO}
        className="prefinal__video"
        play={revealed}
      />

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
