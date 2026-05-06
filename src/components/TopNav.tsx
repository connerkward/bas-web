import { useEffect } from "react";
import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";

// `target` is where the link scrolls to. `activeIds` is the set of section
// ids that should mark this link as the current page — PROJECT scrolls
// to the prefinal opener but stays highlighted across all of prefinal +
// projects (one project, multiple snapping steps).
const SECTIONS = [
  { target: "prefinal", activeIds: ["prefinal", "projects"], label: "PROJECT" },
  { target: "about", activeIds: ["about"], label: "ABOUT" },
] as const;

// Flatten across both nav items so the IO observes prefinal/projects/about.
const TRACKED_IDS = SECTIONS.flatMap((s) => s.activeIds);

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(TRACKED_IDS);

  // Mirror the active section into the URL hash. replaceState keeps history
  // clean (back button doesn't accumulate one entry per scroll). When
  // active is null (hero is in view), the hash is cleared.
  useEffect(() => {
    const want = active ? `#${active}` : "";
    if (window.location.hash === want) return;
    const url =
      window.location.pathname + window.location.search + want;
    history.replaceState(null, "", url);
  }, [active]);

  // Programmatic scroll on tap. Pure `href="#id"` was unreliable on iOS
  // Safari with mandatory scroll-snap on the html element — the hash-jump
  // landed mid-transition and the snap engine sometimes pulled the user
  // back to the prior snap point. Explicit scrollIntoView + hash update
  // is deterministic.
  const handleClick = (target: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(target);
    // `behavior: "smooth"` here gets canceled by `scroll-snap-type:
    // mandatory` on html — the snap engine treats the smooth animation
    // as a user gesture that ended at the start position, so it pulls
    // back to the prior snap point. `instant` jumps in one frame which
    // mandatory snap accepts cleanly.
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    history.replaceState(null, "", `#${target}`);
  };

  return (
    <nav ref={ref} className="topnav">
      {SECTIONS.map(({ target, activeIds, label }) => {
        const isActive = active !== null && (activeIds as readonly string[]).includes(active);
        return (
          <a
            key={target}
            className="topnav__link"
            href={`#${target}`}
            onClick={handleClick(target)}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
