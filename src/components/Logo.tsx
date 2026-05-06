import { useTopBarColor } from "../lib/useTopBarColor";
import { scrollToSection } from "../lib/scrollToSection";

export default function Logo() {
  const ref = useTopBarColor<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      className="logo"
      aria-label="BAS Studio — back to top"
      onClick={() => {
        // Same snap-disable handler as nav buttons. Mandatory snap on
        // html otherwise pulls programmatic scrollTop = 0 back to the
        // current section's snap point on iOS Safari.
        if (window.location.hash) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
        scrollToSection(null);
      }}
    >
      <span className="logo__bas">BAS</span>
      <span className="logo__studio">STUDIO</span>
    </button>
  );
}
