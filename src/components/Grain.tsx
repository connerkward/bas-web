// Animated film-grain overlay. SVG fractal noise via data URI; the rect is
// oversized and translates around so the noise visibly shifts each frame.
const NOISE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">` +
    `<filter id="n">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>` +
    `</filter>` +
    `<rect width="100%" height="100%" filter="url(#n)" opacity="0.55"/>` +
    `</svg>`,
);

export default function Grain() {
  return (
    <div
      className="grain"
      aria-hidden="true"
      style={{ backgroundImage: `url("data:image/svg+xml;utf8,${NOISE_SVG}")` }}
    />
  );
}
