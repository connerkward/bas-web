import { useEffect } from "react";
import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";

const SECTIONS = ["projects", "about"] as const;

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(SECTIONS);

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
      {SECTIONS.map((id) => (
        <a
          key={id}
          className="topnav__link"
          href={`#${id}`}
          aria-current={active === id ? "page" : undefined}
        >
          {id.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
