import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";
import { scrollToSection } from "../lib/scrollToSection";

const SECTIONS = [
  { target: "prefinal", activeIds: ["prefinal", "projects"], label: "PROJECT" },
  { target: "about", activeIds: ["about"], label: "ABOUT" },
] as const;

const TRACKED_IDS = SECTIONS.flatMap((s) => s.activeIds);

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(TRACKED_IDS);

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
            onClick={(e) => {
              e.preventDefault();
              scrollToSection(target);
              history.replaceState(null, "", `#${target}`);
            }}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
