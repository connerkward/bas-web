type MarqueeProps = {
  images: string[];
  direction?: "left" | "right";
  durationSec?: number;
  rowClass: string;
};

// Infinite horizontal scroll. The track holds two copies of the image list so
// translating by -50% loops seamlessly. CSS animation; no JS per-frame work.
export default function Marquee({
  images,
  direction = "left",
  durationSec = 60,
  rowClass,
}: MarqueeProps) {
  const doubled = [...images, ...images];
  return (
    <div className={`marquee ${rowClass}`}>
      <div
        className="marquee__track"
        style={{
          animationDuration: `${durationSec}s`,
          animationDirection: direction === "left" ? "normal" : "reverse",
        }}
      >
        {doubled.map((src, i) => (
          <div className="marquee__tile" key={`${src}-${i}`}>
            <img src={src} alt="" loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
    </div>
  );
}
