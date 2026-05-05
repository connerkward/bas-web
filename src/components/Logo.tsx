import { useTopBarColor } from "../lib/useTopBarColor";

// Document is the scroll container — standard full-page snap pattern.
function scrollToHero() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  // Also clear the section hash so the URL reflects "at top / hero".
  if (window.location.hash) {
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
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
