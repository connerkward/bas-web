import { useTopBarColor } from "../lib/useTopBarColor";

export default function Logo() {
  const ref = useTopBarColor<HTMLAnchorElement>();
  // Plain anchor link to the page root (clears the hash on click).
  // Native browser handles the scroll. Proximity snap (in index.css)
  // doesn't fight it.
  return (
    <a
      ref={ref}
      href="/"
      className="logo"
      aria-label="BAS Studio — back to top"
    >
      <span className="logo__bas">BAS</span>
      <span className="logo__studio">STUDIO</span>
    </a>
  );
}
