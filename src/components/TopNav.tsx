import { useEffect } from "react";
import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";

// `target` is where the link scrolls to. `activeIds` is the set of section
// ids that should mark this link as the current page — PROJECT scrolls to
// the prefinal opener but stays highlighted across all of prefinal +
// projects (one project, multiple snapping steps).
const SECTIONS = [
  { target: "prefinal", activeIds: ["prefinal", "projects"], label: "PROJECT" },
  { target: "about", activeIds: ["about"], label: "ABOUT" },
] as const;

const TRACKED_IDS = SECTIONS.flatMap((s) => s.activeIds);

function scrollToTarget(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  const html = document.documentElement;
  // Mandatory scroll-snap on `html` (index.css) was eating programmatic
  // scrolls on iOS Safari: clicking a nav button updated the URL hash
  // and `aria-current` styling, but the page never moved — the snap
  // engine immediately re-anchored to the prior snap point because the
  // programmatic `scrollTop = ...` wasn't preceded by a user gesture
  // it could attribute. Temporarily neutralize snap, jump, then
  // restore snap on the next frame so the new position becomes the
  // anchor instead of getting overridden.
  const prevSnap = html.style.scrollSnapType;
  html.style.scrollSnapType = "none";
  html.scrollTop = el.offsetTop;
  history.replaceState(null, "", `#${target}`);
  requestAnimationFrame(() => {
    html.style.scrollSnapType = prevSnap;
  });
}

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(TRACKED_IDS);

  useEffect(() => {
    const want = active ? `#${active}` : "";
    if (window.location.hash === want) return;
    const url =
      window.location.pathname + window.location.search + want;
    history.replaceState(null, "", url);
  }, [active]);

  // Plain buttons. The interactive layer no longer lives inside a
  // mix-blend-mode parent (the topbar was split into two independent
  // fixed elements in App.tsx — see App.css `.topbar-left` / `.topbar-
  // right`), so iOS Safari delivers taps to these buttons cleanly. No
  // `pointer-events: auto` re-enable, no native event-listener escape
  // hatch, no `touch-action: manipulation` workaround needed.
  return (
    <nav ref={ref} className="topnav">
      {SECTIONS.map(({ target, activeIds, label }) => {
        const isActive =
          active !== null && (activeIds as readonly string[]).includes(active);
        return (
          <button
            key={target}
            type="button"
            className="topnav__link"
            onClick={() => scrollToTarget(target)}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
