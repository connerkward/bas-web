import { useTopBarColor } from "../lib/useTopBarColor";

export default function Logo() {
  const ref = useTopBarColor<HTMLDivElement>();
  return (
    <div ref={ref} className="logo">
      <span className="logo__bas">BAS</span>
      <span className="logo__studio">STUDIO</span>
    </div>
  );
}
