import { useEffect, useRef, useState } from "react";
import TimeTicker from "./TimeTicker";

const BAS_LETTERS = "BAS".split("");

export default function Footer() {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    // `.page` is the actual scroll container (see App.css).
    const root = document.querySelector(".page");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35, root },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <footer ref={ref} className="footer">
      <div className="footer__top">
        <div className="footer__col">
          <div className="footer__label">CONTACT</div>
          <a className="footer__line" href="mailto:hello@bas.studio">
            HELLO@BAS.STUDIO
          </a>
          <div className="footer__line">+1 (000) 000—0000</div>
        </div>
        <div className="footer__col">
          <div className="footer__label">INDEX</div>
          <a className="footer__line" href="#projects">
            01 — PROJECTS
          </a>
          <a className="footer__line" href="#about">
            02 — ABOUT
          </a>
          <a className="footer__line" href="#contact">
            03 — CONTACT
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
          <a className="footer__line" href="#">
            GITHUB ↗
          </a>
          <a className="footer__line" href="#">
            ARE.NA ↗
          </a>
        </div>
        <div className="footer__col footer__col--right">
          <div className="footer__label">LOCATION</div>
          <div className="footer__line">
            <TimeTicker />
          </div>
          <div className="footer__line">40.689°N, 74.044°W</div>
        </div>
      </div>

      <div className="footer__brand">
        <div
          className={`footer__bas${revealed ? " footer__bas--in" : ""}`}
          aria-label="BAS"
        >
          {BAS_LETTERS.map((letter, i) => (
            <span
              key={i}
              className="footer__bas-letter"
              style={{ animationDelay: `${i * 90}ms` }}
              aria-hidden="true"
            >
              {letter}
            </span>
          ))}
        </div>
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
