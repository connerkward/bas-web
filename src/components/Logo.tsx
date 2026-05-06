import { useTopBarColor } from "../lib/useTopBarColor";

export default function Logo() {
  const ref = useTopBarColor<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      className="logo"
      aria-label="BAS Studio — back to top"
      onClick={() => {
        // Scroll to top WITHOUT a full reload. `<a href="/">` would cause
        // a navigation; browser scroll-restoration then puts the user back
        // where they were on the reloaded page (= "click home → stays on
        // the same project step", which the user reported).
        window.scrollTo(0, 0);
        if (window.location.hash) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      }}
    >
      <span className="logo__bas">BAS</span>
      <span className="logo__studio">STUDIO</span>
    </button>
  );
}
