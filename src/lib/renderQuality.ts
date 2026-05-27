// Auto-tuning render quality. We pick a tier ONCE at boot from cheap signals
// (CPU cores, device memory, devicePixelRatio, and the WebGL renderer string)
// and derive every cost knob (DPR cap, geometry density, dust, postprocessing,
// intro animation) from it. No UI — the scene self-tunes so weak/integrated/
// software GPUs and battery-saving phones don't drop frames on the WebGL hero.

export type QualityTier = "low" | "medium" | "high";

export interface QualitySettings {
  tier: QualityTier;
  // Hard cap on the Canvas devicePixelRatio. Fragment-shader cost scales with
  // the square of DPR, so this is the single biggest lever on a fill-rate-
  // bound scene (our relief is one big lit plane). Lower cap = fewer pixels.
  dpr: number;
  // PlaneGeometry subdivisions for the procedural relief / backdrop. More
  // segments = more vertices through the vertex shader + a denser displacement.
  // Cut on low-end where vertex throughput is the bottleneck.
  reliefSegments: [number, number];
  // Drifting dust-mote sprites. ~250 transparent additive points = an extra
  // blended draw pass every frame; the cheapest thing to drop entirely on
  // low-end where overdraw hurts.
  dust: boolean;
  // The film-grain Noise EffectComposer pass. A full-screen post pass is pure
  // fill-rate the GPU can't skip; disabling it removes one full framebuffer
  // read/write per frame on weak GPUs.
  postprocessing: boolean;
  // MSAA on the WebGL context. 4x MSAA multiplies the per-sample shading/
  // resolve cost; off on low-end (the grain pass + low DPR hides aliasing).
  antialias: boolean;
  // The warm rect-area footlight. RectAreaLight uses an expensive LTC area-
  // light shader path; on low-end we fall back to the cheaper torch point
  // light alone and skip the second light's per-fragment cost.
  bottomBar: boolean;
}

// Read the UNMASKED_RENDERER_WEBGL string from a throwaway context, then
// discard it. Names like "SwiftShader", "llvmpipe", "Microsoft Basic Render",
// or Intel integrated parts signal a GPU that will struggle with a fill-heavy
// lit scene. Wrapped in try/catch — the debug extension may be blocked, or
// WebGL may be unavailable; either way we just skip this signal.
function detectWeakGpu(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return true; // no WebGL at all → treat as weakest
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return false; // can't tell; don't penalize
    const renderer = String(
      gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "",
    ).toLowerCase();
    // Software rasterizers + known-slow integrated parts.
    return (
      renderer.includes("swiftshader") ||
      renderer.includes("llvmpipe") ||
      renderer.includes("software") ||
      renderer.includes("basic render") ||
      renderer.includes("microsoft basic") ||
      // Older Intel integrated GPUs (HD Graphics 2000–5000 era). Iris/Iris Xe
      // are fine, so don't blanket-match "intel".
      /intel.*\bhd graphics\b/.test(renderer)
    );
  } catch {
    return false;
  }
}

// Score-based tier. Each weak signal subtracts points; we bucket the result.
// Doing it additively (rather than a chain of early returns) means no single
// signal alone forces "low" — e.g. a 4-core phone with a fine GPU and decent
// memory stays "medium" instead of being knocked to "low" on core count alone.
export function detectQualityTier(): QualityTier {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return "high"; // SSR: assume capable; the client re-detects on mount

  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory is Chromium-only and coarse (0.25–8, capped). Absent on
  // Safari/Firefox — treat absence as "unknown, don't penalize."
  const mem = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const dpr = window.devicePixelRatio ?? 1;
  const weakGpu = detectWeakGpu();

  let score = 0;
  // CPU cores: a proxy for overall device class. drei/three do meaningful
  // per-frame work on the main thread (raycast, light updates).
  if (cores >= 8) score += 2;
  else if (cores >= 4) score += 1;
  // Device memory (when known): <4GB is a low-end phone / cheap laptop.
  if (mem !== undefined) {
    if (mem >= 8) score += 1;
    else if (mem <= 2) score -= 1;
  }
  // A very high DPR (≥3, common on phones) multiplies fragment cost; pair it
  // with a low core count and it's a budget phone trying to push 3× pixels.
  if (dpr >= 3 && cores < 6) score -= 1;
  // Software / weak integrated GPU dominates — push hard toward low.
  if (weakGpu) score -= 3;

  if (score <= 0) return "low";
  if (score <= 2) return "medium";
  return "high";
}

// Map a tier to concrete cost knobs. Keep "high" visually identical to the
// pre-tuning scene; only "medium"/"low" cut.
export function qualityFor(tier: QualityTier): QualitySettings {
  const capDpr = (max: number) =>
    Math.min(typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1, max);

  switch (tier) {
    case "low":
      return {
        tier,
        dpr: capDpr(1), // never supersample — fill rate is the bottleneck
        reliefSegments: [160, 100], // half the segments → half the vertices
        dust: false, // drop the extra transparent draw pass
        postprocessing: false, // drop the full-screen grain pass
        antialias: false, // no MSAA; low DPR + grain hide the aliasing
        bottomBar: false, // single light only — skip the LTC area-light path
      };
    case "medium":
      return {
        tier,
        dpr: capDpr(1.25),
        reliefSegments: [240, 150],
        dust: true,
        postprocessing: true,
        antialias: true,
        bottomBar: true,
      };
    case "high":
    default:
      return {
        tier,
        dpr: capDpr(2),
        reliefSegments: [320, 200], // original density
        dust: true,
        postprocessing: true,
        antialias: true,
        bottomBar: true,
      };
  }
}

// Convenience: detect the tier and return its full settings in one call.
export function detectQuality(): QualitySettings {
  return qualityFor(detectQualityTier());
}

// Back-compat: callers that only want the DPR number. Now derived from the
// tier so it stays in sync with the rest of the cost knobs.
export function detectInitialDpr(): number {
  return detectQuality().dpr;
}
