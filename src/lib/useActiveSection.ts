import { useEffect, useState } from "react";

// Minimum visible fraction for a section to count as "active." Below this,
// `active` returns to null — important so the hero (which has no id and is
// not observed) doesn't leave a stale id stuck when the user scrolls back
// to the top.
const MIN_ACTIVE_RATIO = 0.5;

// Returns the id of the section currently most in view, or null if none
// crosses the dominance threshold. Watches a list of element ids via a
// single IntersectionObserver.
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const ratios = new Map<string, number>();
    // Document is the scroll container — null root = viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.intersectionRatio);
        }
        let bestId: string | null = null;
        let bestRatio = MIN_ACTIVE_RATIO;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        setActive(bestId);
      },
      // Multiple thresholds let us track which section dominates as the
      // user scrolls between snap points.
      { threshold: [0.25, 0.5, 0.75, 1] },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
