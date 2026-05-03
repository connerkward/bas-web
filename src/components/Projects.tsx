import { useEffect, useRef, useState, type CSSProperties } from "react";
import CrossfadeVideo from "./CrossfadeVideo";

const KEY_GRAPHIC = "/experiments/key.jpg";

// Inline transition-delay stamp for staggered reveal cascades — same idiom
// as the prefinal section.
const D = (ms: number): CSSProperties => ({ ["--d" as never]: `${ms}ms` });

type HeadProps = {
  no: string;
  title: string;
  tech: string;
  date: string;
};

function StepHead({ no, title, tech, date }: HeadProps) {
  return (
    <header className="step__head">
      <span className="step__no">{no}</span>
      <span className="step__head-title">{title}</span>
      <span className="step__meta">
        <span className="step__tech">{tech}</span>
        <span className="step__sep">·</span>
        <span className="step__date">{date}</span>
      </span>
    </header>
  );
}

function Clip({ src }: { src: string }) {
  return (
    <video
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      aria-hidden="true"
    />
  );
}

function StepEarly() {
  return (
    <section className="step step--wide" data-step="01">
      <StepHead no="01" title="EARLY EXPERIMENTS" tech="R&D" date="2024–2025" />
      <div className="step__body">
        <div className="step__media-wide">
          <img
            src={KEY_GRAPHIC}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
        <div className="step__copy step__copy--two-col">
          <h3 className="step__display">
            One source.<br />
            Many signals.
          </h3>
          <p className="step__blurb">
            Process studies on a single subject — a runner photographed in
            profile. Each pass strips the frame to one channel: dithered
            halftones, pixelation thresholds, contour lines, depth-derived
            isophotes. The vocabulary that the relief geometry was eventually
            cut from.
          </p>
        </div>
      </div>
    </section>
  );
}

function StepMold() {
  return (
    <section className="step step--right-media" data-step="02">
      <StepHead
        no="02"
        title="MOLD STUDIES"
        tech="3D PRINT · SILICONE · CAST"
        date="2025"
      />
      <div className="step__body">
        <div className="step__copy">
          <h3 className="step__display">
            Cast first.<br />
            Then we hit the limit.
          </h3>
          <p className="step__blurb">
            First fabrication path: 3D-print the relief, ABS-vapor smooth, pour
            a silicone rubber mold, cast in resin. Surface quality was there.
            Print volume wasn't — scaling to gallery panels would have meant
            tiling the mold and chasing seams.
          </p>
          <dl className="step__status">
            <dt>Status</dt>
            <dd>Abandoned</dd>
            <dt>Replaced by</dt>
            <dd>Direct CNC</dd>
          </dl>
        </div>
        <div className="step__portrait">
          <Clip src="/videos/mold-2.mp4" />
        </div>
      </div>
    </section>
  );
}

function StepFabrication() {
  return (
    <section className="step step--diptych" data-step="03">
      <StepHead
        no="03"
        title="FABRICATION"
        tech="CAM · CNC · SHOPBOT"
        date="2025–2026"
      />
      <div className="step__body">
        <h3 className="step__display step__display--centered">
          Plan in software.<br />
          Cut in wood.
        </h3>
        <div className="step__triptych">
          <figure className="step__triptych-cell">
            <div className="step__portrait">
              <Clip src="/videos/toolpath.mp4" />
            </div>
            <figcaption>
              <span className="step__cap-label">SIM</span>
              <span className="step__cap-value">Fusion 360 · toolpath</span>
            </figcaption>
          </figure>
          <figure className="step__triptych-cell">
            <div className="step__portrait">
              <Clip src="/videos/milling-1.mp4" />
            </div>
            <figcaption>
              <span className="step__cap-label">CUT</span>
              <span className="step__cap-value">ShopBot · sheet stock</span>
            </figcaption>
          </figure>
          <figure className="step__triptych-cell">
            <div className="step__portrait">
              <Clip src="/videos/fab-wide.mp4" />
            </div>
            <figcaption>
              <span className="step__cap-label">WIDE</span>
              <span className="step__cap-value">Cut panel · shop floor</span>
            </figcaption>
          </figure>
        </div>
        <p className="step__blurb step__blurb--centered">
          Toolpath generated in Fusion, run on the ShopBot at gallery scale.
          One sheet, one pass — no tiling, no seams.
        </p>
      </div>
    </section>
  );
}

function StepController() {
  return (
    <section className="step step--left-media" data-step="04">
      <StepHead
        no="04"
        title="CONTROLLER"
        tech="MIDI · TOUCHDESIGNER"
        date="2026"
      />
      <div className="step__body">
        <div className="step__portrait">
          <Clip src="/videos/controller.mp4" />
        </div>
        <div className="step__copy">
          <h3 className="step__display">
            A tactile authoring surface.
          </h3>
          <p className="step__blurb">
            Hardware MIDI controller patched into TouchDesigner — a tactile
            authoring tool for the depth-map layering. The same unit sat in
            the gallery as a public input, letting visitors recompose the
            projection live.
          </p>
          <dl className="step__specs">
            <dt>Signal</dt>
            <dd>MIDI out</dd>
            <dt>Host</dt>
            <dd>TouchDesigner</dd>
            <dt>Role</dt>
            <dd>Depth-map author</dd>
            <dt>Mount</dt>
            <dd>Gallery · public</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}

function StepLook() {
  return (
    <section className="step step--pair" data-step="05">
      <StepHead
        no="05"
        title="LOOK"
        tech="DAVINCI RESOLVE · GRADE"
        date="2025–2026"
      />
      <div className="step__body">
        <div className="step__pair">
          <figure className="step__pair-cell">
            <div className="step__portrait">
              <img
                src="/experiments/davinci-grade.png"
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
            <figcaption>
              <span className="step__cap-label">FRAME</span>
              <span className="step__cap-value">Look study · still</span>
            </figcaption>
          </figure>
          <figure className="step__pair-cell">
            <div className="step__portrait">
              <Clip src="/videos/look-grade.mp4" />
            </div>
            <figcaption>
              <span className="step__cap-label">LOOP</span>
              <span className="step__cap-value">Iterations · v1</span>
            </figcaption>
          </figure>
        </div>
        <p className="step__blurb step__blurb--centered">
          Iterating the look in DaVinci Resolve — pushing contrast, crushing
          midtones, and tuning chroma until the depth-mapped figure read
          cleanly off the milled relief at gallery throw distance.
        </p>
      </div>
    </section>
  );
}

function StepInstallation() {
  // Mirrors the prefinal section: side-by-side crossfade-loop video + copy
  // block with staggered reveal cascade. Triggers its own IO so the
  // animation only fires when it scrolls into view.
  const ref = useRef<HTMLElement>(null);
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
      { threshold: 0.3, root },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={`step step--finale${revealed ? " step--finale-in" : ""}`}
      data-step="06"
    >
      <StepHead no="06" title="INSTALLATION" tech="GALLERY" date="2026" />
      <div className="step__body">
        <CrossfadeVideo
          src="/videos/install-1.mp4"
          className="step__feature-video"
        />
        <div className="step__feature-copy">
          <p className="step__feature-meta" style={D(0)}>
            <span className="step__feature-meta-label">ON VIEW</span>
            <span className="step__feature-meta-detail">
              GRAY AREA GRAND THEATER · BYOB · APRIL 7
            </span>
          </p>
          <h3 className="step__feature-title">
            <span
              className="step__feature-title-line step__feature-title-line--lead"
              style={D(120)}
            >
              A runner,
            </span>
            <span
              className="step__feature-title-line step__feature-title-line--accent"
              style={D(280)}
            >
              held in relief.
            </span>
          </h3>
          <p className="step__feature-blurb" style={D(520)}>
            The piece on the gallery floor — a milled relief panel under raking
            light, the runner's stride read across surface and shadow as
            visitors moved past. Source video plays in profile beside the
            relief; the body in the panel and the body on screen meet in
            the same beat.
          </p>
          <p className="step__feature-caption" style={D(720)}>
            Piece installed · San Francisco · 2026
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Projects() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const root = document.querySelector(".page");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, root },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`projects${revealed ? " projects--in" : ""}`}>
      <StepEarly />
      <StepMold />
      <StepFabrication />
      <StepController />
      <StepLook />
      <StepInstallation />
    </div>
  );
}
