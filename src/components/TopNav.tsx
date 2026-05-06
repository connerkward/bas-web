import { useEffect } from "react";
import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";

// `target` is the section id the link points to. `activeIds` is the set
// of sections that should mark this link as the current page — PROJECT
// scrolls to the prefinal opener but stays highlighted across all of
// prefinal + projects (one project, multiple snapping steps).
const SECTIONS = [
  { target: "prefinal", activeIds: ["prefinal", "projects"], label: "PROJECT" },
  { target: "about", activeIds: ["about"], label: "ABOUT" },
] as const;

const TRACKED_IDS = SECTIONS.flatMap((s) => s.activeIds);

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(TRACKED_IDS);

  // Mirror the active section into the URL hash so the URL is shareable.
  // replaceState keeps history clean (no entry per scroll).
  useEffect(() => {
    const want = active ? `#${active}` : "";
    if (window.location.hash === want) return;
    const url = window.location.pathname + window.location.search + want;
    history.replaceState(null, "", url);
  }, [active]);

  // Plain anchor links. Browser handles the scroll natively — sections are
  // exactly viewport-height apart so each hash target is a valid snap
  // point under `scroll-snap-type: y mandatory` on html. No JS scroll
  // handlers, no snap-disable workarounds. If this is unreliable on a
  // specific browser, that's a browser bug worth a single targeted fix
  // — not the foundation of nav.
  return (
    <nav ref={ref} className="topnav">
      {SECTIONS.map(({ target, activeIds, label }) => {
        const isActive =
          active !== null && (activeIds as readonly string[]).includes(active);
        return (
          <a
            key={target}
            className="topnav__link"
            href={`#${target}`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
