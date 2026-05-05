import { useTopBarColor } from "../lib/useTopBarColor";

// The actual scroll container is `.page` (fixed inset:0; html/body scroll
// is locked — see App.css). `window.scrollTo` is a no-op here, so we have
// to address `.page` directly.
function scrollToHero() {
  const page = document.querySelector(".page");
  if (page) page.scrollTo({ top: 0, behavior: "smooth" });
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
