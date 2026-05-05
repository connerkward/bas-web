import { useEffect } from "react";
import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";

// id stays "projects" so existing hash links still resolve, but the visible
// label is the singular "PROJECT" — the section is one project with multiple
// sub-snapping process steps.
const SECTIONS = [
  { id: "projects", label: "PROJECT" },
  { id: "about", label: "ABOUT" },
] as const;

const SECTION_IDS = SECTIONS.map((s) => s.id);

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(SECTION_IDS);

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

  return (
    <nav ref={ref} className="topnav">
      {SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          className="topnav__link"
          href={`#${id}`}
          aria-current={active === id ? "page" : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
