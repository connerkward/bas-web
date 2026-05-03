import { useEffect, useRef, useState } from "react";
import Marquee from "./Marquee";

type ProjectEntry = {
  no: string;
  title: string;
  type: string;
  year: string;
};

const PORTRAIT_TILES = [
  "/experiments/s01.jpg",
  "/experiments/c01.jpg",
  "/experiments/s02.jpg",
  "/experiments/c02.jpg",
  "/experiments/s03.jpg",
  "/experiments/c03.jpg",
  "/experiments/s04.jpg",
  "/experiments/c04.jpg",
  "/experiments/c05.jpg",
  "/experiments/c06.jpg",
];

const LANDSCAPE_TILES = [
  "/experiments/a01.jpg",
  "/experiments/a02.jpg",
  "/experiments/a03.jpg",
  "/experiments/a04.jpg",
  "/experiments/a05.jpg",
  "/experiments/a06.jpg",
  "/experiments/a07.jpg",
  "/experiments/a08.jpg",
];

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
        <Marquee
          images={LANDSCAPE_TILES}
          direction="left"
          durationSec={90}
          rowClass="marquee--landscape"
        />
        <Marquee
          images={PORTRAIT_TILES}
          direction="right"
          durationSec={70}
          rowClass="marquee--portrait"
        />
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
