import { useTopBarColor } from "../lib/useTopBarColor";
import { scrollToSection } from "../lib/scrollToSection";

function scrollToHero() {
  // Clear the hash FIRST, then scroll. scrollToSection handles the
  // snap-disable + reflow + 200ms restore — without it, smooth scroll
  // races with mandatory scroll-snap on iOS Safari and lands wherever
  // the snap pulls (typically: back to the section the user was on).
  if (window.location.hash) {
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
  scrollToSection(null);
}

export default function Logo() {
  const ref = useTopBarColor<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      className="logo"
      aria-label="BAS Studio — back to top"
      onClick={scrollToHero}
    >
      <span className="logo__bas">BAS</span>
      <span className="logo__studio">STUDIO</span>
    </button>
  );
}
