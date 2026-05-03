import { useEffect, useRef, useState } from "react";

type ProjectEntry = {
  no: string;
  title: string;
  type: string;
  year: string;
};

const KEY_GRAPHIC = "/experiments/key.jpg";
const SECONDARY_GRAPHIC = "/experiments/depth.jpg";

// Placeholder list — swap with real entries later. Order = display order;
// the row number is rendered from `no`, not the array index, so reordering
// or filtering doesn't renumber rows.
const ENTRIES: ProjectEntry[] = [
  { no: "01", title: "Relief Studies", type: "Sculpture · 3D", year: "2026" },
  { no: "02", title: "Hood Ornaments", type: "Object · Series", year: "2025" },
  { no: "03", title: "Hammers", type: "Tooling", year: "2025" },
  { no: "04", title: "Depth Map Tests", type: "R&D", year: "2024" },
  { no: "05", title: "Field Notebooks", type: "Print", year: "2024" },
];

export default function Projects() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    // `.page` is the actual scroll container (see App.css), so the IO
    // root must be it — viewport doesn't scroll any more.
    const root = document.querySelector(".page");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25, root },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`projects${revealed ? " projects--in" : ""}`}
    >
      <div className="projects__head">
        <span className="projects__label">INDEX</span>
        <span className="projects__count">
          {String(ENTRIES.length).padStart(2, "0")}
        </span>
      </div>
      <div className="projects__strip">
        <div className="projects__strip-label">
          <span>EARLY EXPERIMENTS</span>
          <span>R&amp;D · 2024–2025</span>
        </div>
        <div className="projects__feature">
          <div className="projects__feature-main">
            <div className="projects__feature-banner">
              <img
                src={KEY_GRAPHIC}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
            <p className="projects__feature-blurb">
              Process studies on a single source — a runner photographed in
              profile. Each pass strips the frame to one signal: dithered
              halftones, pixelation thresholds, contour lines, depth-derived
              isophotes. Foundation work for the relief geometry above.
            </p>
          </div>
          <figure className="projects__feature-side">
            <div className="projects__feature-side-img">
              <img
                src={SECONDARY_GRAPHIC}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
            <figcaption>
              <span>DEPTH BANDING</span>
              <span>BANDS · BLUR · STROKE</span>
            </figcaption>
          </figure>
        </div>
      </div>
      <ul className="projects__list">
        {ENTRIES.map((p, i) => (
          <li
            key={p.no}
            className="projects__row"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <a className="projects__link" href={`#${p.no}`}>
              <span className="projects__no">{p.no}</span>
              <span className="projects__title">{p.title}</span>
              <span className="projects__type">{p.type}</span>
              <span className="projects__year">{p.year}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
