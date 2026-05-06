import { useEffect, useRef } from "react";
import { useTopBarColor } from "../lib/useTopBarColor";
import { useActiveSection } from "../lib/useActiveSection";

// `target` is where the link scrolls to. `activeIds` is the set of section
// ids that should mark this link as the current page — PROJECT scrolls
// to the prefinal opener but stays highlighted across all of prefinal +
// projects (one project, multiple snapping steps).
const SECTIONS = [
  { target: "prefinal", activeIds: ["prefinal", "projects"], label: "PROJECT" },
  { target: "about", activeIds: ["about"], label: "ABOUT" },
] as const;

const TRACKED_IDS = SECTIONS.flatMap((s) => s.activeIds);

function scrollToTarget(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  document.documentElement.scrollTop = el.offsetTop;
  history.replaceState(null, "", `#${target}`);
}

export default function TopNav() {
  const ref = useTopBarColor<HTMLElement>();
  const active = useActiveSection(TRACKED_IDS);

  useEffect(() => {
    const want = active ? `#${active}` : "";
    if (window.location.hash === want) return;
    const url =
      window.location.pathname + window.location.search + want;
    history.replaceState(null, "", url);
  }, [active]);

  // Native event listeners (NOT React's onClick) attached per-link via ref.
  // React's synthetic event delegation has been observed to drop tap-derived
  // click events on iOS Safari when the event path crosses a `pointer-events:
  // none` ancestor with mix-blend-mode (the topbar). Native listeners on the
  // element bypass React's delegation entirely — the browser fires `click`
  // directly on the listener.
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = navRef.current;
    if (!root) return;
    const links = root.querySelectorAll<HTMLElement>("a[data-target]");
    const cleanups: Array<() => void> = [];
    links.forEach((link) => {
      const target = link.dataset.target!;
      const onActivate = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToTarget(target);
      };
      // `click` covers both mouse and tap-derived activations on every
      // browser including iOS Safari. Using a single listener keeps the
      // event path simple — no double-fire on touch+click.
      link.addEventListener("click", onActivate);
      cleanups.push(() => link.removeEventListener("click", onActivate));
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <nav
      ref={(node) => {
        ref.current = node;
        navRef.current = node;
      }}
      className="topnav"
    >
      {SECTIONS.map(({ target, activeIds, label }) => {
        const isActive = active !== null && (activeIds as readonly string[]).includes(active);
        return (
          <a
            key={target}
            className="topnav__link"
            href={`#${target}`}
            data-target={target}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
