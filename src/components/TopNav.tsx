import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";

const SECTIONS = [
  { target: "prefinal", activeIds: ["prefinal", "projects"], label: "PROJECT" },
  { target: "about", activeIds: ["about"], label: "ABOUT" },
] as const;

const TRACKED_IDS = SECTIONS.flatMap((s) => s.activeIds);

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(TRACKED_IDS);

  // Plain anchor links. Browser handles hash navigation natively. Proximity
  // snap (set on html in index.css) doesn't fight programmatic scrolls.
  // No onClick, no scrollToSection lib, no snap-disable, no hashchange
  // listener — the standard setup, finally. Active highlighting still
  // tracks via IO so the current section's button gets aria-current.
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
