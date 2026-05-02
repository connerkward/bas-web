import { useTopBarColor } from "../lib/useTopBarColor";

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  return (
    <nav ref={ref} className="topnav">
      <a className="topnav__link" href="#projects">
        PROJECTS
      </a>
      <a className="topnav__link" href="#about">
        ABOUT
      </a>
    </nav>
  );
}
