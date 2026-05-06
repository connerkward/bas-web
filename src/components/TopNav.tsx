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
  // Mandatory scroll-snap on `html` (index.css) eats programmatic
  // scrolls on iOS Safari unless we (a) actually defuse the snap
  // before the write — a forced reflow ensures the style change is
  // committed, not just queued — and (b) wait LONG ENOUGH after the
  // write for the snap engine to observe the new position and adopt
  // it as the new anchor before we re-enable mandatory mode. rAF was
  // too short: iOS would re-anchor to the OLD snap point if we
  // restored snap on the next frame, so taps from prefinal/step01
  // (anywhere except scrollY=0) silently snapped back. setTimeout
  // 80ms is empirically enough for the new position to be the
  // accepted anchor.
  html.style.scrollSnapType = "none";
  // Force layout — ensures `scroll-snap-type: none` is committed
  // before the scrollTop write, not still queued in the style update
  // batch.
  void html.offsetHeight;
  html.scrollTop = el.offsetTop;
  history.replaceState(null, "", `#${target}`);
  setTimeout(() => {
    html.style.scrollSnapType = "";
  }, 80);
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
