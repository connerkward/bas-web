import { useTopBarColor } from "../lib/useTopBarColor";

export default function Logo() {
  const ref = useTopBarColor<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      className="logo"
      aria-label="BAS Studio — back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <span className="logo__bas">BAS</span>
      <span className="logo__studio">STUDIO</span>
    </button>
  );
}
