import { useEffect, useRef, useState } from "react";
import TimeTicker from "./TimeTicker";

// Glyph paths extracted from public/fonts/IntraNet.otf via fontTools
// (SVGPathPen + Y-flip transform, units = font upm of 1000). Each path
// is positioned in the wordmark coordinate system: B at x=0, A at
// x=945 (advance 925 + 0.02em gap of 20), S at x=1890. Vertical range
// is the cap-height band only — viewBox y starts at -75 (top of caps,
// since IntraNet's bounding box pokes 75 units above the typo ascent)
// and ends at 800 (baseline). Total: 2765 wide x 875 tall = 3.16:1.
//
// Rendering BAS as inline SVG paths sidesteps the iOS Safari CFF/OTF
// rasterizer entirely — no font dependency for this glyph, no
// line-box clipping, no AA-coverage front during fade-in.
const BAS_VIEWBOX = "0 -75 2765 875";
const BAS_PATHS: string[] = [
  // B
  "M700 187.5C700 235.82 660.82 275 612.5 275H262.5C214.18 275 175 235.82 175 187.5C175 139.16 214.18 100 262.5 100H700V187.5ZM700 625H262.5C214.18 625 175 585.82 175 537.5C175 489.16 214.18 450 262.5 450H612.5C660.82 450 700 489.16 700 537.5V625ZM787.5 275C835.82 275 875 235.82 875 187.5V12.5C875 -35.84 835.82 -75 787.5 -75H262.5C214.18 -75 175 -35.84 175 12.5C175 60.82 135.82 100 87.5 100C39.18 100 0 139.16 0 187.5V712.5C0 760.82 39.18 800 87.5 800H787.5C835.82 800 875 760.82 875 712.5V537.5C875 489.16 835.82 450 787.5 450C739.18 450 700 410.82 700 362.5C700 314.16 739.18 275 787.5 275Z",
  // A
  "M1557.5 450H1207.5C1159.18 450 1120 410.82 1120 362.5C1120 314.18 1159.18 275 1207.5 275C1255.82 275 1295 235.82 1295 187.5C1295 139.18 1334.18 100 1382.5 100C1430.82 100 1470 139.18 1470 187.5C1470 235.82 1509.18 275 1557.5 275C1605.82 275 1645 314.18 1645 362.5C1645 410.82 1605.82 450 1557.5 450ZM1732.5 275C1684.18 275 1645 235.82 1645 187.5V12.5C1645 -35.82 1605.82 -75 1557.5 -75H1207.5C1159.18 -75 1120 -35.82 1120 12.5V187.5C1120 235.82 1080.82 275 1032.5 275C984.18 275 945 314.18 945 362.5V712.5C945 760.82 984.18 800 1032.5 800C1080.82 800 1120 760.82 1120 712.5C1120 664.18 1159.18 625 1207.5 625H1557.5C1605.82 625 1645 664.18 1645 712.5C1645 760.82 1684.18 800 1732.5 800C1780.82 800 1820 760.82 1820 712.5V362.5C1820 314.18 1780.82 275 1732.5 275Z",
  // S
  "M2765 537.5C2765 489.16 2725.82 450 2677.5 450C2629.17 450 2590 410.82 2590 362.5C2590 314.16 2550.82 275 2502.5 275H2152.5C2104.17 275 2065 235.82 2065 187.5C2065 139.16 2104.17 100 2152.5 100H2502.5C2550.82 100 2590 139.16 2590 187.5C2590 235.82 2629.17 275 2677.5 275C2725.82 275 2765 235.82 2765 187.5C2765 139.16 2725.82 100 2677.5 100C2629.17 100 2590 60.82 2590 12.5C2590 -35.83 2550.82 -75 2502.5 -75H2152.5C2104.17 -75 2065 -35.83 2065 12.5C2065 60.82 2025.82 100 1977.5 100C1929.17 100 1890 139.16 1890 187.5C1890 235.82 1929.17 275 1977.5 275C2025.82 275 2065 314.16 2065 362.5C2065 410.82 2104.17 450 2152.5 450H2502.5C2550.82 450 2590 489.16 2590 537.5C2590 585.82 2550.82 625 2502.5 625H2152.5C2104.17 625 2065 585.82 2065 537.5C2065 489.16 2025.82 450 1977.5 450C1929.17 450 1890 489.16 1890 537.5C1890 585.82 1929.17 625 1977.5 625C2025.82 625 2065 664.16 2065 712.5C2065 760.82 2104.17 800 2152.5 800H2502.5C2550.82 800 2590 760.82 2590 712.5C2590 664.16 2629.17 625 2677.5 625C2725.82 625 2765 585.82 2765 537.5Z",
];

export default function Footer() {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    // Document is the scroll container — null root = viewport.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <footer ref={ref} className="footer">
      <div className="footer__top">
        <div className="footer__col">
          <div className="footer__label">INDEX</div>
          <a className="footer__line" href="#projects">
            01 — PROJECTS
          </a>
          <a className="footer__line" href="#about">
            02 — ABOUT
          </a>
        </div>
        <div className="footer__col">
          <div className="footer__label">SOCIAL</div>
          <a
            className="footer__line"
            href="https://www.instagram.com/bas.runn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            INSTAGRAM ↗
          </a>
          <a
            className="footer__line"
            href="https://github.com/connerkward/bas"
            target="_blank"
            rel="noopener noreferrer"
          >
            GITHUB ↗
          </a>
          <a className="footer__line" href="#">
            ARE.NA ↗
          </a>
        </div>
        <div className="footer__col">
          <div className="footer__label">TECHNOLOGIES</div>
          <div className="footer__line">CNC</div>
          <div className="footer__line">FUSION 360</div>
          <div className="footer__line">SHOPBOT</div>
          <div className="footer__line">TOUCH DESIGNER</div>
          <div className="footer__line">BLENDER</div>
          <div className="footer__line">PROJECTION MAPPING</div>
          <div className="footer__line">STREAM DIFFUSION</div>
        </div>
        <div className="footer__col footer__col--right">
          <div className="footer__label">LOCATION</div>
          <div className="footer__line">
            <TimeTicker />
          </div>
          <div className="footer__line">37.775°N, 122.419°W</div>
        </div>
      </div>

      <div className="footer__brand">
        <svg
          className={`footer__bas${revealed ? " footer__bas--in" : ""}`}
          viewBox={BAS_VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="BAS"
          focusable="false"
        >
          {BAS_PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              className="footer__bas-letter"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </svg>
        <div className="footer__meta">
          <div className="footer__meta-row">STUDIO — ©2026</div>
          <div className="footer__meta-row footer__meta-row--icons">
            <span>⊞</span>
            <span>CE</span>
            <span>+</span>
            <span>⊕</span>
            <span>◯</span>
          </div>
          <div className="footer__meta-row">DESIGN — BUILD — DEPLOY</div>
          <div className="footer__meta-row">ALL RIGHTS RESERVED</div>
        </div>
      </div>
    </footer>
  );
}
